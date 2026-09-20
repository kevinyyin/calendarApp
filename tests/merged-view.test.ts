import { describe, it, expect, vi } from "vitest";
import { is, Column, SQL, Param, StringChunk, getTableName } from "drizzle-orm";

vi.mock("@/lib/visibility", () => ({
  getVisibleCalendars: vi.fn(async (viewerId: string) => {
    if (viewerId === "viewer") {
      return [
        { id: "cal-1", userId: "friend-1", displayName: "Work", color: "#111" },
        { id: "cal-2", userId: "friend-2", displayName: "Team", color: "#222" },
      ];
    }
    if (viewerId === "viewer2") {
      return [{ id: "cal-1", userId: "friend-1", displayName: "Work", color: "#111" }];
    }
    return [];
  }),
}));

type Row = Record<string, unknown>;

// merged_view_prefs rows. Includes a row for a *different* viewer to prove
// getMergedViewEvents scopes its prefs lookup to the requesting viewer, not
// just to the friendId.
const prefsRows: Row[] = [
  { viewerId: "viewer", friendId: "friend-2", isVisible: false },
  { viewerId: "someone-else", friendId: "friend-1", isVisible: false },
];

// events rows, keyed by googleCalendarRowId (== the `id` visibility returns
// for each calendar). "Old standup" is outside the requested date range and
// should be excluded regardless of visibility.
const eventRows: Row[] = [
  {
    googleCalendarRowId: "cal-1",
    title: "Standup",
    startAt: new Date("2026-09-18T09:00:00Z"),
    endAt: new Date("2026-09-18T09:15:00Z"),
  },
  {
    googleCalendarRowId: "cal-2",
    title: "Planning",
    startAt: new Date("2026-09-18T10:00:00Z"),
    endAt: new Date("2026-09-18T11:00:00Z"),
  },
  {
    googleCalendarRowId: "cal-1",
    title: "Old standup",
    startAt: new Date("2026-09-10T09:00:00Z"),
    endAt: new Date("2026-09-10T09:15:00Z"),
  },
];

function toCamel(columnName: string): string {
  return columnName.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

// The task brief's own starter mock for `db.select().from().where()` ignores
// its `where` argument entirely (it dispatches purely on which mocked table
// object was passed to `.from()`). That mock does not actually catch a
// broken implementation: since `getMergedViewEvents` calls
// `db.select().from(events).where(...)` once per visible calendar, and the
// brief's mock returns the *same* full `eventRows` array on every call
// regardless of the `where` condition, an implementation using the brief's
// own reference code would return both "Standup" AND "Planning" (mislabeled
// under whichever calendar is currently being iterated) instead of the one
// row the test expects — the test would fail against the very
// implementation the brief tells us to write.
//
// So, following the same approach as tests/friendships.test.ts and
// tests/visibility.test.ts (Tasks 12/13), we import the REAL `@/db/schema`
// (pure metadata, no DB connection at import time) so `eq`/`and`/`gte`/`lte`
// build genuine drizzle-orm `SQL` condition trees, and walk that tree
// structurally against plain JS fixture rows. This means the mock actually
// filters by calendar id, viewer id, and date range the way postgres would.
function evaluateCondition(node: unknown, row: Row): boolean {
  if (node === undefined) return true;
  if (!is(node, SQL)) {
    throw new Error("merged-view.test mock: expected a drizzle SQL condition node");
  }
  const chunks = node.queryChunks;

  // and(...)/or(...) with 2+ conditions wrap the joined group:
  // [StringChunk("("), <joined SQL>, StringChunk(")")].
  if (
    chunks.length === 3 &&
    is(chunks[0], StringChunk) &&
    chunks[0].value[0] === "(" &&
    is(chunks[2], StringChunk) &&
    chunks[2].value[0] === ")"
  ) {
    return evaluateCondition(chunks[1], row);
  }

  // A single eq/gte/lte(column, value): built as
  // [StringChunk(""), Column, StringChunk(" op "), Param, StringChunk("")].
  if (
    chunks.length === 5 &&
    is(chunks[1], Column) &&
    is(chunks[2], StringChunk)
  ) {
    const op = chunks[2].value[0];
    const field = toCamel(chunks[1].name);
    const paramNode = chunks[3];
    const value = is(paramNode, Param) ? paramNode.value : paramNode;
    const rowValue = row[field];

    if (op === " = ") return rowValue === value;
    if (op === " >= ") {
      return toComparable(rowValue) >= toComparable(value);
    }
    if (op === " <= ") {
      return toComparable(rowValue) <= toComparable(value);
    }
  }

  // sql.join'd and()/or() conditions: cond, sep, cond, sep, cond, ...
  if (chunks.length >= 3 && chunks.length % 2 === 1) {
    let op: string | null = null;
    for (let i = 1; i < chunks.length; i += 2) {
      const sep = chunks[i];
      if (!is(sep, StringChunk)) {
        throw new Error("merged-view.test mock: unrecognized condition shape");
      }
      const value = sep.value[0];
      if (value !== " and " && value !== " or ") {
        throw new Error("merged-view.test mock: unrecognized condition shape");
      }
      if (op && op !== value) {
        throw new Error("merged-view.test mock: mixed and/or at the same nesting level");
      }
      op = value;
    }
    const results: boolean[] = [];
    for (let i = 0; i < chunks.length; i += 2) {
      results.push(evaluateCondition(chunks[i], row));
    }
    return op === " and " ? results.every(Boolean) : results.some(Boolean);
  }

  throw new Error("merged-view.test mock: unrecognized condition shape");
}

function toComparable(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  return value as number;
}

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(async (condition: unknown) => {
          const rows = getTableName(table as never) === "merged_view_prefs" ? prefsRows : eventRows;
          return rows.filter((row) => evaluateCondition(condition, row));
        }),
      })),
    })),
  },
}));

import { getMergedViewEvents } from "@/lib/merged-view";

describe("getMergedViewEvents", () => {
  it("excludes events from a calendar whose owner is toggled off", async () => {
    const result = await getMergedViewEvents("viewer", {
      start: new Date("2026-09-18T00:00:00Z"),
      end: new Date("2026-09-19T00:00:00Z"),
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Standup");
    expect(result[0].personUserId).toBe("friend-1");
  });

  it("excludes events outside the requested date range", async () => {
    // "viewer2" sees only cal-1 (friend-1's calendar), with no hidden
    // friends, so "Old standup" (2026-09-10) must be filtered purely by the
    // gte/lte date-range clause, not by the visibility toggle.
    const result = await getMergedViewEvents("viewer2", {
      start: new Date("2026-09-18T00:00:00Z"),
      end: new Date("2026-09-19T00:00:00Z"),
    });

    expect(result.map((e) => e.title)).not.toContain("Old standup");
  });

  it("scopes the visibility toggle lookup to the requesting viewer", async () => {
    // "someone-else" has a prefs row hiding friend-1, but "viewer" does not.
    // If the implementation queried merged_view_prefs without filtering by
    // viewerId, "viewer"'s events could be affected by another viewer's
    // preferences.
    const result = await getMergedViewEvents("viewer", {
      start: new Date("2026-09-18T00:00:00Z"),
      end: new Date("2026-09-19T00:00:00Z"),
    });

    expect(result.some((e) => e.personUserId === "friend-1")).toBe(true);
  });
});
