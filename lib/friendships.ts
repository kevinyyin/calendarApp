import { db } from "@/db/client";
import { users, friendships } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";

export async function sendFriendRequest(
  requesterId: string,
  recipientUsername: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [recipient] = await db
    .select()
    .from(users)
    .where(eq(users.username, recipientUsername));

  if (!recipient) {
    return { ok: false, error: "No user found with that username" };
  }
  if (recipient.id === requesterId) {
    return { ok: false, error: "You cannot friend yourself" };
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

  await db
    .update(friendships)
    .set({
      status: accept ? "accepted" : "declined",
      respondedAt: new Date(),
    })
    .where(eq(friendships.id, friendshipId));

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
