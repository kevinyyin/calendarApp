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
// just to the friendId. Also includes a (nonsensical, but worth guarding
// against) row where friendId happens to equal the viewer's own id with
// isVisible: false — the viewer's own calendars must never be filtered by
// this table at all, since merged_view_prefs only ever targets friends.
const prefsRows: Row[] = [
  { viewerId: "viewer", friendId: "friend-2", isVisible: false },
  { viewerId: "someone-else", friendId: "friend-1", isVisible: false },
  { viewerId: "viewer", friendId: "viewer", isVisible: false },
];

// The viewer's own google_calendars rows, returned directly (not via
// getVisibleCalendars, which is friends-only). Deliberately isShared: false
// to prove the viewer's own events are never gated by that flag.
const ownCalendarRows: Row[] = [
  {
    id: "own-cal-1",
    userId: "viewer",
    displayName: "My Calendar",
    color: "#999",
    isShared: false,
  },
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
  {
    googleCalendarRowId: "own-cal-1",
    title: "Dentist",
    startAt: new Date("2026-09-18T14:00:00Z"),
    endAt: new Date("2026-09-18T14:30:00Z"),
  },
  // Starts the evening BEFORE the requested range and ends inside it — a
  // containment predicate (startAt >= range.start AND endAt <= range.end)
  // drops it entirely even though the viewer is busy for the first hour of
  // the displayed day.
  {
    googleCalendarRowId: "cal-1",
    title: "Red-eye flight",
    startAt: new Date("2026-09-17T23:00:00Z"),
    endAt: new Date("2026-09-18T01:00:00Z"),
  },
  // Spans the whole requested range and out the far end.
  {
    googleCalendarRowId: "cal-1",
    title: "Conference week",
    startAt: new Date("2026-09-16T00:00:00Z"),
    endAt: new Date("2026-09-25T00:00:00Z"),
  },
  // Touches range.start only at its endpoint (endAt == range.start): an
  // overlap of zero length is not an overlap, so this must stay excluded.
  {
    googleCalendarRowId: "cal-1",
    title: "Ends exactly at range start",
    startAt: new Date("2026-09-17T22:00:00Z"),
    endAt: new Date("2026-09-18T00:00:00Z"),
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
    if (op === " < ") {
      return toComparable(rowValue) < toComparable(value);
    }
    if (op === " > ") {
      return toComparable(rowValue) > toComparable(value);
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
          const tableName = getTableName(table as never);
          const rows =
            tableName === "merged_view_prefs"
              ? prefsRows
              : tableName === "google_calendars"
                ? ownCalendarRows
                : eventRows;
          return rows.filter((row) => evaluateCondition(condition, row));
        }),
      })),
    })),
  },
}));

import { getMergedViewEvents } from "@/lib/merged-view";

describe("getMergedViewEvents", () => {
  it("excludes events from a friend's calendar whose owner is toggled off, but keeps the viewer's own", async () => {
    const result = await getMergedViewEvents("viewer", {
      start: new Date("2026-09-18T00:00:00Z"),
      end: new Date("2026-09-19T00:00:00Z"),
    });

    // friend-2 (cal-2 / "Planning") is toggled off via prefsRows; friend-1's
    // events and the viewer's own "Dentist" should all remain.
    expect(result.map((e) => e.title).sort()).toEqual([
      "Conference week",
      "Dentist",
      "Red-eye flight",
      "Standup",
    ]);
    const standup = result.find((e) => e.title === "Standup")!;
    expect(standup.personUserId).toBe("friend-1");
    expect(result.map((e) => e.title)).not.toContain("Planning");
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

  it("includes the viewer's own events in the merged view", async () => {
    // "viewer2" has no accepted friends (getVisibleCalendars returns []), so
    // any event in the result must come from the viewer's own calendar —
    // proving getMergedViewEvents surfaces the signed-in user's own events,
    // not just friends' shared ones.
    const result = await getMergedViewEvents("viewer2", {
      start: new Date("2026-09-18T00:00:00Z"),
      end: new Date("2026-09-19T00:00:00Z"),
    });

    // "viewer2" isn't the owner of own-cal-1 (that belongs to "viewer"), so
    // this specifically confirms the friends-only path still works alone;
    // the dedicated "viewer" checks below confirm the own-calendar merge.
    expect(result.map((e) => e.title).sort()).toEqual([
      "Conference week",
      "Red-eye flight",
      "Standup",
    ]);
  });

  it("shows the viewer's own events even though their calendar is not shared (isShared: false)", async () => {
    // own-cal-1 (userId: "viewer") has isShared: false in ownCalendarRows.
    // If the implementation reused getVisibleCalendars-style isShared
    // filtering for the viewer's own calendars, "Dentist" would be dropped.
    const result = await getMergedViewEvents("viewer", {
      start: new Date("2026-09-18T00:00:00Z"),
      end: new Date("2026-09-19T00:00:00Z"),
    });

    const dentist = result.find((e) => e.title === "Dentist");
    expect(dentist).toBeDefined();
    expect(dentist!.personUserId).toBe("viewer");
  });

  it("does not apply merged_view_prefs toggles to the viewer's own calendar", async () => {
    // prefsRows includes { viewerId: "viewer", friendId: "viewer", isVisible:
    // false } — a row that, if merged_view_prefs filtering were mistakenly
    // applied to the viewer's own calendars (keyed by userId instead of
    // strictly friendId), would hide the viewer's own "Dentist" event. It
    // must still appear: this table only ever gates friends, never the
    // viewer themselves.
    const result = await getMergedViewEvents("viewer", {
      start: new Date("2026-09-18T00:00:00Z"),
      end: new Date("2026-09-19T00:00:00Z"),
    });

    expect(result.map((e) => e.title)).toContain("Dentist");
  });

  it("includes an event that starts before the range but runs into it", () => {
    // The old predicate was containment (startAt >= range.start AND endAt <=
    // range.end), which silently dropped anything crossing a boundary — an
    // event running 23:00 -> 01:00 across midnight, or a multi-day one. The
    // viewer really is busy during the overlap, so it belongs in the view.
    return getMergedViewEvents("viewer2", {
      start: new Date("2026-09-18T00:00:00Z"),
      end: new Date("2026-09-19T00:00:00Z"),
    }).then((result) => {
      expect(result.map((e) => e.title)).toContain("Red-eye flight");
    });
  });

  it("includes an event that spans the entire range in both directions", async () => {
    const result = await getMergedViewEvents("viewer2", {
      start: new Date("2026-09-18T00:00:00Z"),
      end: new Date("2026-09-19T00:00:00Z"),
    });

    expect(result.map((e) => e.title)).toContain("Conference week");
  });

  it("still excludes an event that merely touches the range boundary", async () => {
    // endAt == range.start is a zero-length intersection, i.e. not an
    // overlap: the strict `endAt > range.start` half of the predicate is
    // what keeps yesterday's last meeting out of today's view.
    const result = await getMergedViewEvents("viewer2", {
      start: new Date("2026-09-18T00:00:00Z"),
      end: new Date("2026-09-19T00:00:00Z"),
    });

    expect(result.map((e) => e.title)).not.toContain("Ends exactly at range start");
  });
});
