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
import { Badge } from "@/components/Badge";
import { HomeLanding } from "./HomeLanding";

const rangeFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export default async function HomePage() {
  const session = await auth();
  // "/" is public (see proxy.ts) precisely so this branch can run: a signed
  // -out visitor gets the real landing page here instead of the app just
  // 404-ing or bouncing them to a bare sign-in form with no context.
  if (!session?.user?.id) return <HomeLanding />;

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
    <main className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <div className="animate-rise-in">
        <div className="mb-12 flex flex-col gap-3 sm:mb-16">
          <Badge tone="outline" className="w-fit tabular-nums">
            {rangeFormatter.format(now)} – {rangeFormatter.format(weekFromNow)}
          </Badge>
          <h1 className="text-headline font-semibold text-foreground">This week</h1>
          <p className="max-w-md text-base leading-relaxed text-muted">
            Your events, merged with every friend who&apos;s sharing a calendar
            with you.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16">
          <div className="min-w-0 lg:pt-1">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Showing</h2>
            {hasFriends ? (
              <div className="flex min-w-0 flex-wrap gap-2 lg:flex-col lg:items-start">
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
                            ? "rounded-full border border-dashed border-border bg-surface-muted px-3.5 py-2 text-sm text-muted transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:bg-surface hover:text-foreground disabled:opacity-50"
                            : "rounded-full border border-border bg-surface px-3.5 py-2 text-sm text-muted shadow-[var(--shadow-soft)] transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
                        }
                      >
                        {isHidden ? "Show" : "Hide"} {label}
                      </SubmitButton>
                    </form>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-muted">
                No friends are sharing a calendar with you yet.{" "}
                <Link href="/friends" className="font-medium text-accent hover:underline">
                  Add a friend
                </Link>{" "}
                to see their events here.
              </p>
            )}
          </div>

          <div className="min-w-0">
            <RealtimeMergedView
              initialEvents={events}
              calendarMetaByRowId={calendarMetaByRowId}
              supabaseAccessToken={session.supabaseAccessToken}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
