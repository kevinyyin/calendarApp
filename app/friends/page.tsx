import { db } from "@/db/client";
import { friendships, users } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { FriendRequestForm } from "./FriendRequestForm";
import { UsernameForm } from "./UsernameForm";
import { PendingRequestRow, SentRequestRow, FriendRow } from "./FriendRequestRows";
import { Badge } from "@/components/Badge";

export default async function FriendsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const [me] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId));

  const pendingIncoming = await db
    .select({ id: friendships.id, requesterUsername: users.username })
    .from(friendships)
    .innerJoin(users, eq(friendships.requesterId, users.id))
    .where(and(eq(friendships.recipientId, userId), eq(friendships.status, "pending")));

  const pendingOutgoing = await db
    .select({ id: friendships.id, recipientUsername: users.username })
    .from(friendships)
    .innerJoin(users, eq(friendships.recipientId, users.id))
    .where(and(eq(friendships.requesterId, userId), eq(friendships.status, "pending")));

  const accepted = await db
    .select({ id: friendships.id, friendUsername: users.username })
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
    <main className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <div className="animate-rise-in">
        <div className="mb-12 flex flex-col gap-3 sm:mb-16">
          <div className="flex flex-wrap gap-2">
            <Badge tone="outline">
              {accepted.length} friend{accepted.length === 1 ? "" : "s"}
            </Badge>
            {pendingIncoming.length > 0 && (
              <Badge tone="accent">
                {pendingIncoming.length} waiting on you
              </Badge>
            )}
          </div>
          <h1 className="text-headline font-semibold text-foreground">Friends</h1>
          <p className="max-w-md text-base leading-relaxed text-muted">
            Send a request by username, then share a calendar once you&apos;re connected.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16">
          <div className="min-w-0 lg:pt-1">
            <UsernameForm currentUsername={me?.username ?? null} />
          </div>

          <div className="flex min-w-0 flex-col gap-12">
            {pendingIncoming.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  Pending requests
                </h2>
                <ul className="flex flex-col divide-y divide-border border-y border-border">
                  {pendingIncoming.map((req) => (
                    <PendingRequestRow
                      key={req.id}
                      friendshipId={req.id}
                      requesterUsername={req.requesterUsername ?? ""}
                    />
                  ))}
                </ul>
              </section>
            )}

            <FriendRequestForm />

            {pendingOutgoing.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  Sent requests
                </h2>
                <ul className="flex flex-col divide-y divide-border border-y border-border">
                  {pendingOutgoing.map((req) => (
                    <SentRequestRow
                      key={req.id}
                      friendshipId={req.id}
                      recipientUsername={req.recipientUsername ?? ""}
                    />
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Friends</h2>
              {accepted.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                  <p className="text-sm font-medium text-foreground">No friends yet</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    Send a request above to start sharing calendars.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col divide-y divide-border border-y border-border">
                  {accepted.map((f) => (
                    <FriendRow key={f.id} friendshipId={f.id} friendUsername={f.friendUsername ?? ""} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
