import { describe, it, expect, vi } from "vitest";
import { is, Column, SQL, Param, StringChunk } from "drizzle-orm";

vi.mock("@/lib/friendships", () => ({
  getAcceptedFriendIds: vi.fn(async (userId: string) =>
    userId === "viewer" ? ["friend-1", "friend-2"] : [],
  ),
}));

const calendarRows = [
  { id: "cal-1", userId: "friend-1", displayName: "Work", color: "#111", isShared: true },
  { id: "cal-2", userId: "friend-1", displayName: "Personal", color: "#222", isShared: false },
  { id: "cal-3", userId: "friend-2", displayName: "Team", color: "#333", isShared: true },
  { id: "cal-4", userId: "not-a-friend", displayName: "Random", color: "#444", isShared: true },
];

function toCamel(columnName: string): string {
  return columnName.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

// Rather than a `where()` mock that ignores its argument (which would let a
// broken implementation that never filters by `isShared` still pass), we use
// the real `@/db/schema` module (pure metadata, no DB connection at import
// time) so `eq(googleCalendars.isShared, true)` builds a genuine drizzle-orm
// `SQL` condition tree, and walk that tree structurally to evaluate it
// against each fixture row. This mirrors the approach taken in
// tests/friendships.test.ts for Task 12's mock work, and means this test
// genuinely proves the implementation's DB query filters on `isShared`,
// not just that the final output happens to look right.
function evaluateCondition(node: unknown, row: Record<string, unknown>): boolean {
  if (!is(node, SQL)) {
    throw new Error("visibility.test mock: expected a drizzle SQL condition node");
  }
  const chunks = node.queryChunks;

  // A single eq(column, value): built as
  // [StringChunk(""), Column, StringChunk(" = "), Param, StringChunk("")].
  if (
    chunks.length === 5 &&
    is(chunks[1], Column) &&
    is(chunks[2], StringChunk) &&
    chunks[2].value[0] === " = "
  ) {
    const field = toCamel(chunks[1].name);
    const paramNode = chunks[3];
    const value = is(paramNode, Param) ? paramNode.value : paramNode;
    return row[field] === value;
  }

  throw new Error("visibility.test mock: unrecognized condition shape");
}

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async (condition: unknown) =>
          calendarRows.filter((row) => evaluateCondition(condition, row)),
        ),
      })),
    })),
  },
}));

import { getVisibleCalendars } from "@/lib/visibility";

describe("getVisibleCalendars", () => {
  it("returns only shared calendars belonging to accepted friends", async () => {
    const result = await getVisibleCalendars("viewer");
    expect(result.map((c) => c.id)).toEqual(["cal-1", "cal-3"]);
  });

  it("returns an empty list for a viewer with no friends", async () => {
    const result = await getVisibleCalendars("loner");
    expect(result).toEqual([]);
  });

  it("excludes a friend's calendar that is not shared", async () => {
    // cal-2 belongs to friend-1 (an accepted friend of "viewer") but has
    // isShared: false. If the implementation dropped the DB-level
    // `isShared` filter and relied on the friend-ID filter alone, this
    // would incorrectly appear in the result.
    const result = await getVisibleCalendars("viewer");
    expect(result.map((c) => c.id)).not.toContain("cal-2");
  });

  it("excludes a shared calendar belonging to a non-friend", async () => {
    // cal-4 is isShared: true but owned by "not-a-friend". If the
    // implementation dropped the application-level friend filter and
    // returned everything the DB query gave back, this would incorrectly
    // appear in the result.
    const result = await getVisibleCalendars("viewer");
    expect(result.map((c) => c.id)).not.toContain("cal-4");
  });
});
