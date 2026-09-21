import { db } from "@/db/client";
import { friendships, users } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { respondToFriendRequestAction } from "./actions";
import { FriendRequestForm } from "./FriendRequestForm";
import { SubmitButton } from "@/components/SubmitButton";

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
    <main className="mx-auto max-w-lg px-6 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Friends</h1>
        <p className="mt-1 text-sm text-muted">
          Send a request by username, then share a calendar once you&apos;re connected.
        </p>
      </div>

      <FriendRequestForm />

      {pendingIncoming.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Pending requests
          </h2>
          <ul className="flex flex-col gap-2">
            {pendingIncoming.map((req) => (
              <li
                key={req.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface p-3"
              >
                <span className="text-sm text-foreground">{req.requesterUsername}</span>
                <div className="flex gap-2">
                  <form action={respondToFriendRequestAction}>
                    <input type="hidden" name="friendshipId" value={req.id} />
                    <input type="hidden" name="accept" value="true" />
                    <SubmitButton
                      pendingText="Accepting…"
                      className="rounded-md bg-accent px-3 py-1 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      Accept
                    </SubmitButton>
                  </form>
                  <form action={respondToFriendRequestAction}>
                    <input type="hidden" name="friendshipId" value={req.id} />
                    <input type="hidden" name="accept" value="false" />
                    <SubmitButton
                      pendingText="Declining…"
                      className="rounded-md bg-surface-muted px-3 py-1 text-sm font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50"
                    >
                      Decline
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Friends</h2>
        {accepted.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm font-medium text-foreground">No friends yet</p>
            <p className="mt-1 text-sm text-muted">
              Send a request above to start sharing calendars.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {accepted.map((f, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-surface p-3 text-sm text-foreground"
              >
                {f.friendUsername}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
