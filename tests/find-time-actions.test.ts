import { describe, it, expect, vi } from "vitest";
import { is, Column, SQL, Param, StringChunk, getTableName } from "drizzle-orm";

type Row = Record<string, unknown>;

// The viewer's own google_calendars row, fetched directly (not through
// getVisibleCalendars, which is friends-only) so the viewer's own busy time
// is always included in slot-finding, regardless of isShared — that flag
// only gates what FRIENDS can see of this user's calendars, not what the
// viewer sees of their own data. This mirrors the established pattern in
// lib/merged-view.ts's getRelevantCalendarsForViewer (Task 14/15).
const ownCalendarRows: Row[] = [
  {
    id: "cal-viewer",
    userId: "viewer",
    displayName: "Mine",
    color: "#000",
    isShared: false,
  },
];

// Events keyed by googleCalendarRowId. The viewer's own event (10:00-13:00)
// exactly covers what would otherwise look like a free 3-hour gap between
// friend-a's and friend-b's busy blocks — this is what proves the viewer's
// own busy time is genuinely queried and merged in, not just claimed.
const eventRows: Row[] = [
  {
    googleCalendarRowId: "cal-friend-a",
    startAt: new Date("2026-09-18T09:00:00Z"),
    endAt: new Date("2026-09-18T10:00:00Z"),
  },
  {
    googleCalendarRowId: "cal-friend-b",
    startAt: new Date("2026-09-18T13:00:00Z"),
    endAt: new Date("2026-09-18T14:00:00Z"),
  },
  {
    googleCalendarRowId: "cal-viewer",
    startAt: new Date("2026-09-18T10:00:00Z"),
    endAt: new Date("2026-09-18T13:00:00Z"),
  },
];

function toCamel(columnName: string): string {
  return columnName.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

// The task brief's own starter mock for `db.select().from().where()`
// ignores both its table and its `where` argument entirely — it always
// returns the same fixed `eventRows` array no matter what's queried. That
// mock can't prove the viewer's-own-busy-time fix: an implementation that
// forgot to query the viewer's own google_calendars row (or that queried
// events without properly scoping by calendar id) would still pass, since
// the mock hands back the same rows regardless. So, following the same
// approach as tests/merged-view.test.ts (Tasks 14/15) and
// tests/visibility.test.ts / tests/friendships.test.ts (Tasks 12/13), this
// mock imports the REAL @/db/schema (pure metadata, no DB connection at
// import time) so `eq`/`inArray` build genuine drizzle-orm SQL condition
// trees, and walks that tree structurally against plain JS fixture rows —
// dispatching on the queried table's real name, and actually filtering by
// the condition's column/operator/value the way postgres would.
function evaluateCondition(node: unknown, row: Row): boolean {
  if (node === undefined) return true;
  if (!is(node, SQL)) {
    throw new Error("find-time-actions.test mock: expected a drizzle SQL condition node");
  }
  const chunks = node.queryChunks;

  // A single eq(column, value) or inArray(column, values), built as:
  // eq:      [StringChunk(""), Column, StringChunk(" = "),  Param,        StringChunk("")]
  // inArray: [StringChunk(""), Column, StringChunk(" in "), Param[],      StringChunk("")]
  if (chunks.length === 5 && is(chunks[1], Column) && is(chunks[2], StringChunk)) {
    const op = chunks[2].value[0];
    const field = toCamel(chunks[1].name);
    const rowValue = row[field];

    if (op === " = ") {
      const paramNode = chunks[3];
      const value = is(paramNode, Param) ? paramNode.value : paramNode;
      return rowValue === value;
    }

    if (op === " in ") {
      const params = chunks[3] as unknown[];
      const values = params.map((p) => (is(p, Param) ? p.value : p));
      return values.includes(rowValue);
    }
  }

  throw new Error("find-time-actions.test mock: unrecognized condition shape");
}

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(async (condition: unknown) => {
          const tableName = getTableName(table as never);
          const rows = tableName === "google_calendars" ? ownCalendarRows : eventRows;
          return rows.filter((row) => evaluateCondition(condition, row));
        }),
      })),
    })),
  },
}));

vi.mock("@/lib/visibility", () => ({
  getVisibleCalendars: vi.fn(async () => [
    { id: "cal-friend-a", userId: "friend-a", displayName: "A", color: "#111" },
    { id: "cal-friend-b", userId: "friend-b", displayName: "B", color: "#222" },
  ]),
}));

import { findMutualFreeSlots } from "@/app/find-time/actions";

describe("findMutualFreeSlots", () => {
  it("groups busy intervals per person before computing gaps", async () => {
    const slots = await findMutualFreeSlots("viewer", {
      friendUserIds: ["friend-a", "friend-b"],
      start: new Date("2026-09-18T08:00:00Z"),
      end: new Date("2026-09-18T16:00:00Z"),
      durationMinutes: 60,
    });

    // friend-a is busy 09:00-10:00 and friend-b is busy 13:00-14:00, so
    // considering friends alone, 10:00-13:00 would look free. The viewer's
    // own event (10:00-13:00, from ownCalendarRows/eventRows above) exactly
    // fills that gap, so it must NOT be returned as free — this is the
    // viewer's-own-busy-time fix under test. Without the fix (i.e. against
    // the brief's literal `findMutualFreeSlots`, which never queries the
    // viewer's own calendar), this assertion fails.
    expect(slots).not.toContainEqual({
      start: new Date("2026-09-18T10:00:00Z"),
      end: new Date("2026-09-18T13:00:00Z"),
    });

    // Once the viewer's own 10:00-13:00 event is correctly merged with
    // friend-a's and friend-b's busy blocks, all three combine into one
    // continuous busy stretch (09:00-14:00), leaving exactly two free
    // slots in the 08:00-16:00 window.
    expect(slots).toContainEqual({
      start: new Date("2026-09-18T08:00:00Z"),
      end: new Date("2026-09-18T09:00:00Z"),
    });
    expect(slots).toContainEqual({
      start: new Date("2026-09-18T14:00:00Z"),
      end: new Date("2026-09-18T16:00:00Z"),
    });
    expect(slots).toHaveLength(2);
  });

  it("still excludes a friend not passed in friendUserIds, even though they're visible to the viewer", async () => {
    // getVisibleCalendars mock returns both friend-a and friend-b; passing
    // only friend-a means friend-b's busy block must never be considered
    // (the friendUserIds filter from the original brief still applies on
    // top of the viewer's-own-busy-time fix).
    const slots = await findMutualFreeSlots("viewer", {
      friendUserIds: ["friend-a"],
      start: new Date("2026-09-18T08:00:00Z"),
      end: new Date("2026-09-18T16:00:00Z"),
      durationMinutes: 60,
    });

    // Busy: friend-a 09:00-10:00, viewer 10:00-13:00 -> merged 09:00-13:00.
    // friend-b's 13:00-14:00 must NOT be included, so 13:00-16:00 should be
    // free as a single unbroken slot.
    expect(slots).toContainEqual({
      start: new Date("2026-09-18T13:00:00Z"),
      end: new Date("2026-09-18T16:00:00Z"),
    });
  });

  it("does not error and still finds friends' mutual free time when the viewer has no calendars of their own", async () => {
    // A viewer id with no matching row in ownCalendarRows: the
    // implementation must not blow up, and must not exclude everyone, just
    // because the viewer's own google_calendars query returns nothing.
    const slots = await findMutualFreeSlots("viewer-no-calendars", {
      friendUserIds: ["friend-a", "friend-b"],
      start: new Date("2026-09-18T08:00:00Z"),
      end: new Date("2026-09-18T16:00:00Z"),
      durationMinutes: 60,
    });

    expect(slots).toContainEqual({
      start: new Date("2026-09-18T10:00:00Z"),
      end: new Date("2026-09-18T13:00:00Z"),
    });
  });
});
