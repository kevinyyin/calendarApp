import { db } from "@/db/client";
import { users, friendships } from "@/db/schema";
import { eq, and, or, ne, sql } from "drizzle-orm";

export async function sendFriendRequest(
  requesterId: string,
  recipientUsername: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Case-insensitive and trimmed: "Alice" vs "alice", or a stray trailing
  // space, used to silently fail with "No user found" for no reason the
  // sender could diagnose. setUsername's own uniqueness check is
  // case-insensitive too (see app/onboarding/actions.ts), so this can never
  // become ambiguous against two users differing only in case.
  const normalizedUsername = recipientUsername.trim().toLowerCase();
  const [recipient] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.username})`, normalizedUsername));

  if (!recipient) {
    return { ok: false, error: "No user found with that username" };
  }
  if (recipient.id === requesterId) {
    return { ok: false, error: "You cannot friend yourself" };
  }

  // Guard both directions. Without this a double-clicked submit created two
  // identical pending rows, and an A->B request could coexist with a B->A
  // one — both acceptable, after which `getAcceptedFriendIds` returns the
  // same friend twice (they match on the requester side AND the recipient
  // side) and they appear duplicated in every listing.
  //
  // Declined rows are excluded deliberately: a decline isn't a permanent
  // block, so a later request should still be allowed.
  const [existing] = await db
    .select()
    .from(friendships)
    .where(
      and(
        ne(friendships.status, "declined"),
        or(
          and(
            eq(friendships.requesterId, requesterId),
            eq(friendships.recipientId, recipient.id),
          ),
          and(
            eq(friendships.requesterId, recipient.id),
            eq(friendships.recipientId, requesterId),
          ),
        ),
      ),
    );

  if (existing) {
    return {
      ok: false,
      error:
        existing.status === "accepted"
          ? "You're already friends with that user"
          : "There's already a pending friend request with that user",
    };
  }

  await db.insert(friendships).values({
    requesterId,
    recipientId: recipient.id,
    status: "pending",
  });

  return { ok: true };
}

export async function respondToFriendRequest(
  friendshipId: string,
  userId: string,
  accept: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [friendship] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId));

  if (!friendship || friendship.recipientId !== userId) {
    return { ok: false, error: "Friend request not found" };
  }

  // Only a request still awaiting an answer can be answered. Without this, a
  // stale form or a replayed POST could flip an already-declined request to
  // accepted (or re-decline an accepted one) long after the fact.
  if (friendship.status !== "pending") {
    return { ok: false, error: "That friend request has already been answered" };
  }

  await db
    .update(friendships)
    .set({
      status: accept ? "accepted" : "declined",
      respondedAt: new Date(),
    })
    .where(eq(friendships.id, friendshipId));

  return { ok: true };
}

// Deletes the row rather than marking it declined: a cancelled request just
// disappears, so the sender can immediately re-send to the same username
// later. Marking it declined would reuse respondToFriendRequest's status
// column, but the recipient would then see it as if THEY had declined you,
// which is misleading — they never answered it at all.
export async function cancelFriendRequest(
  friendshipId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [friendship] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId));

  if (!friendship || friendship.requesterId !== userId) {
    return { ok: false, error: "Friend request not found" };
  }
  if (friendship.status !== "pending") {
    return { ok: false, error: "That friend request has already been answered" };
  }

  await db.delete(friendships).where(eq(friendships.id, friendshipId));
  return { ok: true };
}

// Only removes an ACCEPTED friendship — cancelling a still-pending request
// you sent goes through cancelFriendRequest instead, and answering one you
// received goes through respondToFriendRequest. Either party can remove it.
export async function removeFriendship(
  friendshipId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [friendship] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId));

  if (
    !friendship ||
    (friendship.requesterId !== userId && friendship.recipientId !== userId)
  ) {
    return { ok: false, error: "Friendship not found" };
  }
  if (friendship.status !== "accepted") {
    return { ok: false, error: "You're not friends with that user" };
  }

  await db.delete(friendships).where(eq(friendships.id, friendshipId));
  return { ok: true };
}

export async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  const rows = await db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, userId), eq(friendships.recipientId, userId)),
      ),
    );

  return rows.map((f) => (f.requesterId === userId ? f.recipientId : f.requesterId));
}
