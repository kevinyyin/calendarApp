import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  getMergedViewEvents,
  getRelevantCalendarsForViewer,
  getHiddenFriendIds,
} from "@/lib/merged-view";
import { getVisibleCalendars } from "@/lib/visibility";
import { RealtimeMergedView } from "@/components/RealtimeMergedView";
import { toggleFriendVisibility } from "@/app/actions/merged-view";
import { SubmitButton } from "@/components/SubmitButton";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [events, visibleCalendars, relevantCalendars, hiddenFriendIds] =
    await Promise.all([
      getMergedViewEvents(session.user.id, { start: now, end: weekFromNow }),
      // Friends-only, used below to build the show/hide buttons — a user
      // should never see a button to hide themselves. Note this is NOT
      // filtered by the visibility toggle, so hidden friends still get a
      // button (a "Show" one).
      getVisibleCalendars(session.user.id),
      // Own + visible-friend calendars, used to give realtime coverage to every
      // calendar that could produce a merged-view event, including ones with
      // zero events in the currently-displayed range.
      getRelevantCalendarsForViewer(session.user.id),
      // Which of those friends are currently toggled off, so each button can
      // submit the OPPOSITE of the current state.
      getHiddenFriendIds(session.user.id),
    ]);

  const friendsByUserId = new Map(
    visibleCalendars.map((c) => [c.userId, c.displayName]),
  );

  const calendarMetaByRowId = Object.fromEntries(
    relevantCalendars.map((c) => [
      c.id,
      { personUserId: c.userId, personLabel: c.displayName, color: c.color },
    ]),
  );

  const hasFriends = friendsByUserId.size > 0;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">This week</h1>
        <p className="mt-1 text-sm text-muted">
          Your events, merged with every friend who&apos;s sharing a calendar
          with you.
        </p>
      </div>

      {hasFriends ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {[...friendsByUserId.entries()].map(([friendId, label]) => {
            const isHidden = hiddenFriendIds.has(friendId);
            return (
              <form key={friendId} action={toggleFriendVisibility}>
                <input type="hidden" name="friendId" value={friendId} />
                {/* Submits the opposite of the current state. Hard-coding
                    "false" here meant a hidden friend could only be brought
                    back by editing the database. */}
                <input
                  type="hidden"
                  name="visible"
                  value={isHidden ? "true" : "false"}
                />
                <SubmitButton
                  pendingText={isHidden ? "Showing…" : "Hiding…"}
                  aria-pressed={isHidden}
                  className={
                    isHidden
                      ? "rounded-full border border-dashed border-border bg-surface-muted px-3 py-3 text-sm text-muted transition active:scale-95 hover:bg-surface hover:text-foreground disabled:opacity-50"
                      : "rounded-full border border-border bg-surface px-3 py-3 text-sm text-muted transition active:scale-95 hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
                  }
                >
                  {isHidden ? "Show" : "Hide"} {label}
                </SubmitButton>
              </form>
            );
          })}
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          No friends are sharing a calendar with you yet.{" "}
          <Link href="/friends" className="font-medium text-accent hover:underline">
            Add a friend
          </Link>{" "}
          to see their events here.
        </div>
      )}

      <RealtimeMergedView
        initialEvents={events}
        calendarMetaByRowId={calendarMetaByRowId}
        supabaseAccessToken={session.supabaseAccessToken}
      />
    </main>
  );
}
