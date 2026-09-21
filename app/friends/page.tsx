import { db } from "@/db/client";
import { friendships, users } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import {
  respondToFriendRequestAction,
  cancelFriendRequestAction,
  removeFriendAction,
} from "./actions";
import { FriendRequestForm } from "./FriendRequestForm";
import { UsernameForm } from "./UsernameForm";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
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
                    <li
                      key={req.id}
                      className="flex items-center justify-between gap-4 py-3.5 first:pt-2.5 last:pb-2.5"
                    >
                      <span className="text-sm font-medium text-foreground">{req.requesterUsername}</span>
                      <div className="flex gap-2">
                        <form action={respondToFriendRequestAction}>
                          <input type="hidden" name="friendshipId" value={req.id} />
                          <input type="hidden" name="accept" value="true" />
                          <SubmitButton
                            pendingText="Accepting…"
                            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:opacity-90 disabled:opacity-50"
                          >
                            Accept
                          </SubmitButton>
                        </form>
                        <form action={respondToFriendRequestAction}>
                          <input type="hidden" name="friendshipId" value={req.id} />
                          <input type="hidden" name="accept" value="false" />
                          <SubmitButton
                            pendingText="Declining…"
                            className="rounded-full bg-danger-muted px-4 py-2 text-sm font-medium text-danger transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:opacity-80 disabled:opacity-50"
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

            <FriendRequestForm />

            {pendingOutgoing.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  Sent requests
                </h2>
                <ul className="flex flex-col divide-y divide-border border-y border-border">
                  {pendingOutgoing.map((req) => (
                    <li
                      key={req.id}
                      className="flex items-center justify-between gap-4 py-3.5 first:pt-2.5 last:pb-2.5"
                    >
                      <span className="text-sm text-foreground">
                        {req.recipientUsername}{" "}
                        <span className="text-muted">— awaiting response</span>
                      </span>
                      <form action={cancelFriendRequestAction}>
                        <input type="hidden" name="friendshipId" value={req.id} />
                        <SubmitButton
                          pendingText="Cancelling…"
                          className="rounded-full bg-surface-muted px-4 py-2 text-sm font-medium text-muted transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:text-foreground disabled:opacity-50"
                        >
                          Cancel
                        </SubmitButton>
                      </form>
                    </li>
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
                    <li
                      key={f.id}
                      className="flex items-center justify-between gap-4 py-3.5 text-sm font-medium text-foreground first:pt-2.5 last:pb-2.5"
                    >
                      {f.friendUsername}
                      <form action={removeFriendAction}>
                        <input type="hidden" name="friendshipId" value={f.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`Remove ${f.friendUsername ?? "this friend"}? They'll stop seeing your shared calendars, and you'll stop seeing theirs.`}
                          confirmLabel="Yes, remove"
                          variant="danger"
                          pendingText="Removing…"
                          className="rounded-full bg-danger-muted px-4 py-2 text-sm font-medium text-danger transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:opacity-80 disabled:opacity-50"
                        >
                          Remove
                        </ConfirmSubmitButton>
                      </form>
                    </li>
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
