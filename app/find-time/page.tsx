import Link from "next/link";
import { db } from "@/db/client";
import { friendships, users } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { FindTimeForm } from "./FindTimeForm";

export default async function FindTimePage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const accepted = await db
    .select({ username: users.username })
    .from(friendships)
    .innerJoin(
      users,
      or(
        and(eq(friendships.requesterId, userId), eq(users.id, friendships.recipientId)),
        and(eq(friendships.recipientId, userId), eq(users.id, friendships.requesterId)),
      ),
    )
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, userId), eq(friendships.recipientId, userId)),
      ),
    );

  const friendUsernames = accepted
    .map((f) => f.username)
    .filter((u): u is string => Boolean(u));

  if (friendUsernames.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 sm:py-20">
        <div className="animate-rise-in">
          <div className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Find a time</h1>
          </div>
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm font-medium text-foreground">No friends yet</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Add a friend first, then come back here to find a time that works
              for both of you.
            </p>
            <Link
              href="/friends"
              className="mt-4 inline-block font-medium text-accent hover:underline"
            >
              Add a friend
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <FindTimeForm friendUsernames={friendUsernames} />;
}
