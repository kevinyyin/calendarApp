import { describe, it, expect, beforeEach, vi } from "vitest";
import { is, Column, SQL, Param, StringChunk, getTableName } from "drizzle-orm";

type Row = Record<string, unknown>;

const state: { users: Row[]; friendships: Row[] } = {
  users: [],
  friendships: [],
};

function resetState() {
  state.users = [
    { id: "user-a", username: "alice" },
    { id: "user-b", username: "bob" },
  ];
  state.friendships = [];
}

function toCamel(columnName: string): string {
  return columnName.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

// The task brief's own starter mock for `db.select().from().where()` ignores
// its `where` argument entirely and always returns every row for the table —
// which happens to make `sendFriendRequest("user-a", "nobody")` (looking up
// a username that doesn't exist) incorrectly "find" the first seeded user.
// The brief explicitly calls this out as simplified and tells us to adjust
// the mock shape so it reflects how the real query code calls the DB.
//
// Rather than re-mock `@/db/schema` with fake column stand-ins (which would
// make `eq(friendships.status, ...)` etc. build on `undefined` columns), we
// use the REAL schema module (pure metadata, no DB connection at import
// time) so `eq`/`and`/`or` build genuine drizzle-orm `SQL` condition trees.
// This function walks that real tree structurally and evaluates it against
// a plain JS row, so the mock actually respects requester/recipient/status
// filters, including the AND-of-ORs shape `getAcceptedFriendIds` uses.
function evaluateCondition(node: unknown, row: Row): boolean {
  if (node === undefined) return true;
  if (!is(node, SQL)) {
    throw new Error("friendships.test mock: expected a drizzle SQL condition node");
  }
  const chunks = node.queryChunks;

  // and(...)/or(...) with 2+ conditions wrap the joined group in a bare
  // "(" ... ")" pair: [StringChunk("("), <joined SQL>, StringChunk(")")].
  if (
    chunks.length === 3 &&
    is(chunks[0], StringChunk) &&
    chunks[0].value[0] === "(" &&
    is(chunks[2], StringChunk) &&
    chunks[2].value[0] === ")"
  ) {
    return evaluateCondition(chunks[1], row);
  }

  // eq(sql`lower(${column})`, value): lib/friendships.ts's case-insensitive
  // username lookup. Same 5-chunk shape as a plain eq, but chunks[1] is
  // itself the nested SQL node for `lower(${column})` — queryChunks
  // [StringChunk("lower("), Column, StringChunk(")")] — rather than a bare
  // Column, and the compared value is a raw string (not Param-wrapped),
  // both confirmed by inspecting drizzle-orm's actual output for this
  // exact call shape rather than assumed.
  if (
    chunks.length === 5 &&
    is(chunks[1], SQL) &&
    chunks[1].queryChunks.length === 3 &&
    is(chunks[1].queryChunks[0], StringChunk) &&
    chunks[1].queryChunks[0].value[0] === "lower(" &&
    is(chunks[1].queryChunks[1], Column) &&
    is(chunks[1].queryChunks[2], StringChunk) &&
    chunks[1].queryChunks[2].value[0] === ")" &&
    is(chunks[2], StringChunk) &&
    chunks[2].value[0] === " = "
  ) {
    const field = toCamel(chunks[1].queryChunks[1].name);
    const rawValue = row[field];
    const paramNode = chunks[3];
    const compareValue = is(paramNode, Param) ? paramNode.value : paramNode;
    return (
      typeof rawValue === "string" &&
      typeof compareValue === "string" &&
      rawValue.toLowerCase() === compareValue.toLowerCase()
    );
  }

  // A single eq/ne(column, value): built by `sql`${column} = ${param}`` as
  // [StringChunk(""), Column, StringChunk(" = "), Param, StringChunk("")]
  // (`ne` is identical but with a " <> " separator).
  if (
    chunks.length === 5 &&
    is(chunks[1], Column) &&
    is(chunks[2], StringChunk) &&
    (chunks[2].value[0] === " = " || chunks[2].value[0] === " <> ")
  ) {
    const field = toCamel(chunks[1].name);
    const paramNode = chunks[3];
    const value = is(paramNode, Param) ? paramNode.value : paramNode;
    return chunks[2].value[0] === " = " ? row[field] === value : row[field] !== value;
  }

  // sql.join'd and()/or() conditions: cond, sep, cond, sep, cond, ...
  if (chunks.length >= 3 && chunks.length % 2 === 1) {
    let op: string | null = null;
    for (let i = 1; i < chunks.length; i += 2) {
      const sep = chunks[i];
      if (!is(sep, StringChunk)) {
        throw new Error("friendships.test mock: unrecognized condition shape");
      }
      const value = sep.value[0];
      if (value !== " and " && value !== " or ") {
        throw new Error("friendships.test mock: unrecognized condition shape");
      }
      if (op && op !== value) {
        throw new Error("friendships.test mock: mixed and/or at the same nesting level");
      }
      op = value;
    }
    const results: boolean[] = [];
    for (let i = 0; i < chunks.length; i += 2) {
      results.push(evaluateCondition(chunks[i], row));
    }
    return op === " and " ? results.every(Boolean) : results.some(Boolean);
  }

  throw new Error("friendships.test mock: unrecognized condition shape");
}

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(async (condition: unknown) => {
          const rows = getTableName(table as never) === "users" ? state.users : state.friendships;
          return rows.filter((row) => evaluateCondition(condition, row));
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (row: Row) => {
        state.friendships.push({ id: `f-${state.friendships.length + 1}`, ...row });
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((patch: Row) => ({
        where: vi.fn(async (condition: unknown) => {
          for (const row of state.friendships) {
            if (evaluateCondition(condition, row)) Object.assign(row, patch);
          }
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async (condition: unknown) => {
        state.friendships = state.friendships.filter(
          (row) => !evaluateCondition(condition, row),
        );
      }),
    })),
  },
}));

import {
  sendFriendRequest,
  respondToFriendRequest,
  cancelFriendRequest,
  removeFriendship,
  getAcceptedFriendIds,
} from "@/lib/friendships";

describe("sendFriendRequest", () => {
  beforeEach(() => {
    resetState();
  });

  it("returns an error when the username does not exist", async () => {
    const result = await sendFriendRequest("user-a", "nobody");
    expect(result).toEqual({ ok: false, error: "No user found with that username" });
    expect(state.friendships).toHaveLength(0);
  });

  it("creates a pending friendship for a valid username", async () => {
    const result = await sendFriendRequest("user-a", "bob");
    expect(result).toEqual({ ok: true });
    expect(state.friendships).toHaveLength(1);
    expect(state.friendships[0]).toMatchObject({
      requesterId: "user-a",
      recipientId: "user-b",
      status: "pending",
    });
  });

  it("returns an error when a user tries to friend themselves", async () => {
    const result = await sendFriendRequest("user-b", "bob");
    expect(result).toEqual({ ok: false, error: "You cannot friend yourself" });
    expect(state.friendships).toHaveLength(0);
  });

  it("rejects a duplicate request to someone who already has a pending one", async () => {
    // A double-clicked submit button used to create two identical pending
    // rows, which then both showed up in the recipient's inbox.
    state.friendships = [
      { id: "f-1", requesterId: "user-a", recipientId: "user-b", status: "pending" },
    ];

    const result = await sendFriendRequest("user-a", "bob");

    expect(result.ok).toBe(false);
    expect(state.friendships).toHaveLength(1);
  });

  it("rejects a duplicate request to someone who is already an accepted friend", async () => {
    state.friendships = [
      { id: "f-1", requesterId: "user-a", recipientId: "user-b", status: "accepted" },
    ];

    const result = await sendFriendRequest("user-a", "bob");

    expect(result.ok).toBe(false);
    expect(state.friendships).toHaveLength(1);
  });

  it("rejects a reciprocal request when the other party already requested first", async () => {
    // B->A already exists; A->B must not be created alongside it, or both
    // can be accepted and the friend appears twice in every listing (they
    // match on both the requester and the recipient side).
    state.friendships = [
      { id: "f-1", requesterId: "user-b", recipientId: "user-a", status: "pending" },
    ];

    const result = await sendFriendRequest("user-a", "bob");

    expect(result.ok).toBe(false);
    expect(state.friendships).toHaveLength(1);
  });

  it("allows a fresh request after a previous one was declined", async () => {
    // A decline is not a permanent block — the guard only considers
    // pending/accepted rows, in either direction.
    state.friendships = [
      { id: "f-1", requesterId: "user-a", recipientId: "user-b", status: "declined" },
    ];

    const result = await sendFriendRequest("user-a", "bob");

    expect(result).toEqual({ ok: true });
    expect(state.friendships).toHaveLength(2);
  });

  it("does not block a request just because the requester has an unrelated friendship", async () => {
    state.users.push({ id: "user-c", username: "carol" });
    state.friendships = [
      { id: "f-1", requesterId: "user-a", recipientId: "user-c", status: "accepted" },
    ];

    const result = await sendFriendRequest("user-a", "bob");

    expect(result).toEqual({ ok: true });
    expect(state.friendships).toHaveLength(2);
  });

  it("finds the recipient regardless of case, and trims surrounding whitespace", async () => {
    const result = await sendFriendRequest("user-a", "  BoB  ");

    expect(result).toEqual({ ok: true });
    expect(state.friendships[0]).toMatchObject({
      requesterId: "user-a",
      recipientId: "user-b",
    });
  });
});

describe("respondToFriendRequest", () => {
  beforeEach(() => {
    resetState();
    state.friendships = [
      { id: "f-1", requesterId: "user-a", recipientId: "user-b", status: "pending" },
    ];
  });

  it("marks the friendship accepted when the recipient accepts", async () => {
    const result = await respondToFriendRequest("f-1", "user-b", true);
    expect(result).toEqual({ ok: true });
    expect(state.friendships[0].status).toBe("accepted");
    expect(state.friendships[0].respondedAt).toBeInstanceOf(Date);
  });

  it("marks the friendship declined when the recipient declines", async () => {
    const result = await respondToFriendRequest("f-1", "user-b", false);
    expect(result).toEqual({ ok: true });
    expect(state.friendships[0].status).toBe("declined");
  });

  it("returns an error when the responder is not the recipient", async () => {
    const result = await respondToFriendRequest("f-1", "user-a", true);
    expect(result).toEqual({ ok: false, error: "Friend request not found" });
    expect(state.friendships[0].status).toBe("pending");
  });

  it("returns an error when the friendship does not exist", async () => {
    state.friendships = [];
    const result = await respondToFriendRequest("missing", "user-b", true);
    expect(result).toEqual({ ok: false, error: "Friend request not found" });
  });

  it("refuses to accept a request that was already declined", async () => {
    // Without a status check, a stale form (or a replayed POST) could flip a
    // declined request to accepted long after the recipient said no.
    state.friendships = [
      { id: "f-1", requesterId: "user-a", recipientId: "user-b", status: "declined" },
    ];

    const result = await respondToFriendRequest("f-1", "user-b", true);

    expect(result.ok).toBe(false);
    expect(state.friendships[0].status).toBe("declined");
  });

  it("refuses to re-answer a request that was already accepted", async () => {
    state.friendships = [
      { id: "f-1", requesterId: "user-a", recipientId: "user-b", status: "accepted" },
    ];

    const result = await respondToFriendRequest("f-1", "user-b", false);

    expect(result.ok).toBe(false);
    expect(state.friendships[0].status).toBe("accepted");
  });
});

describe("getAcceptedFriendIds", () => {
  beforeEach(() => {
    resetState();
  });

  it("returns the other party's id for accepted rows in either direction", async () => {
    state.friendships = [
      { id: "f-1", requesterId: "user-a", recipientId: "user-b", status: "accepted" },
      { id: "f-2", requesterId: "user-c", recipientId: "user-a", status: "accepted" },
      { id: "f-3", requesterId: "user-a", recipientId: "user-d", status: "pending" },
      { id: "f-4", requesterId: "user-x", recipientId: "user-y", status: "accepted" },
    ];

    const result = await getAcceptedFriendIds("user-a");
    expect(result.slice().sort()).toEqual(["user-b", "user-c"]);
  });

  it("returns an empty array when there are no accepted friendships", async () => {
    state.friendships = [];
    const result = await getAcceptedFriendIds("user-a");
    expect(result).toEqual([]);
  });
});

describe("cancelFriendRequest", () => {
  beforeEach(() => {
    resetState();
    state.friendships = [
      { id: "f-1", requesterId: "user-a", recipientId: "user-b", status: "pending" },
    ];
  });

  it("deletes a pending request when the requester cancels it", async () => {
    const result = await cancelFriendRequest("f-1", "user-a");
    expect(result).toEqual({ ok: true });
    expect(state.friendships).toHaveLength(0);
  });

  it("refuses to cancel a request that isn't yours", async () => {
    // The recipient (user-b) is not the requester and must not be able to
    // cancel a request sent TO them — that's what decline is for.
    const result = await cancelFriendRequest("f-1", "user-b");
    expect(result.ok).toBe(false);
    expect(state.friendships).toHaveLength(1);
  });

  it("refuses to cancel a request that's already been answered", async () => {
    state.friendships[0].status = "accepted";
    const result = await cancelFriendRequest("f-1", "user-a");
    expect(result.ok).toBe(false);
    expect(state.friendships).toHaveLength(1);
  });

  it("returns an error when the friendship does not exist", async () => {
    const result = await cancelFriendRequest("missing", "user-a");
    expect(result.ok).toBe(false);
  });
});

describe("removeFriendship", () => {
  beforeEach(() => {
    resetState();
    state.friendships = [
      { id: "f-1", requesterId: "user-a", recipientId: "user-b", status: "accepted" },
    ];
  });

  it("deletes an accepted friendship when the requester removes it", async () => {
    const result = await removeFriendship("f-1", "user-a");
    expect(result).toEqual({ ok: true });
    expect(state.friendships).toHaveLength(0);
  });

  it("deletes an accepted friendship when the recipient removes it", async () => {
    // Either party can end an accepted friendship, not just whoever sent
    // the original request.
    const result = await removeFriendship("f-1", "user-b");
    expect(result).toEqual({ ok: true });
    expect(state.friendships).toHaveLength(0);
  });

  it("refuses to remove a friendship you're not part of", async () => {
    const result = await removeFriendship("f-1", "user-c");
    expect(result.ok).toBe(false);
    expect(state.friendships).toHaveLength(1);
  });

  it("refuses to remove a still-pending request", async () => {
    // A pending request goes through cancelFriendRequest (sender) or
    // respondToFriendRequest (recipient), not removeFriendship.
    state.friendships[0].status = "pending";
    const result = await removeFriendship("f-1", "user-a");
    expect(result.ok).toBe(false);
    expect(state.friendships).toHaveLength(1);
  });

  it("returns an error when the friendship does not exist", async () => {
    const result = await removeFriendship("missing", "user-a");
    expect(result.ok).toBe(false);
  });
});
