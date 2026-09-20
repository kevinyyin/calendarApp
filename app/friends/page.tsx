import { db } from "@/db/client";
import { friendships, users } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { sendFriendRequestAction, respondToFriendRequestAction } from "./actions";

export default async function FriendsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const pendingIncoming = await db
    .select({ id: friendships.id, requesterUsername: users.username })
    .from(friendships)
    .innerJoin(users, eq(friendships.requesterId, users.id))
    .where(and(eq(friendships.recipientId, userId), eq(friendships.status, "pending")));

  const accepted = await db
    .select({ friendUsername: users.username })
    .from(friendships)
    .innerJoin(
      users,
      or(
        and(eq(friendships.requesterId, userId), eq(users.id, friendships.recipientId)),
        and(eq(friendships.recipientId, userId), eq(users.id, friendships.requesterId)),
      ),
    )
    .where(and(eq(friendships.status, "accepted"), or(eq(friendships.requesterId, userId), eq(friendships.recipientId, userId))));

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Friends</h1>

      <form action={sendFriendRequestAction} className="mb-6 flex gap-2">
        <input name="username" placeholder="username" required className="rounded border px-3 py-2" />
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
          Send request
        </button>
      </form>

      <h2 className="mb-2 font-medium">Pending requests</h2>
      <ul className="mb-6 flex flex-col gap-2">
        {pendingIncoming.map((req) => (
          <li key={req.id} className="flex items-center justify-between rounded border p-3">
            <span>{req.requesterUsername}</span>
            <div className="flex gap-2">
              <form action={respondToFriendRequestAction}>
                <input type="hidden" name="friendshipId" value={req.id} />
                <input type="hidden" name="accept" value="true" />
                <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-sm text-white">
                  Accept
                </button>
              </form>
              <form action={respondToFriendRequestAction}>
                <input type="hidden" name="friendshipId" value={req.id} />
                <input type="hidden" name="accept" value="false" />
                <button type="submit" className="rounded bg-slate-200 px-3 py-1 text-sm">
                  Decline
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mb-2 font-medium">Friends</h2>
      <ul className="flex flex-col gap-2">
        {accepted.map((f, i) => (
          <li key={i} className="rounded border p-3">
            {f.friendUsername}
          </li>
        ))}
      </ul>
    </main>
  );
}
