import Link from "next/link";
import { auth } from "@/lib/auth";
import { getMergedViewEvents, getRelevantCalendarsForViewer } from "@/lib/merged-view";
import { getVisibleCalendars } from "@/lib/visibility";
import { CalendarGrid } from "@/components/CalendarGrid";
import { RealtimeMergedView } from "@/components/RealtimeMergedView";
import { toggleFriendVisibility } from "@/app/actions/merged-view";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [events, visibleCalendars, relevantCalendars] = await Promise.all([
    getMergedViewEvents(session.user.id, { start: now, end: weekFromNow }),
    // Friends-only, used below to build the "Hide {friend}" buttons — a user
    // should never see a button to hide themselves.
    getVisibleCalendars(session.user.id),
    // Own + visible-friend calendars, used to give realtime coverage to every
    // calendar that could produce a merged-view event, including ones with
    // zero events in the currently-displayed range.
    getRelevantCalendarsForViewer(session.user.id),
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
          {[...friendsByUserId.entries()].map(([friendId, label]) => (
            <form key={friendId} action={toggleFriendVisibility}>
              <input type="hidden" name="friendId" value={friendId} />
              <input type="hidden" name="visible" value="false" />
              <button
                type="submit"
                className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                Hide {label}
              </button>
            </form>
          ))}
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
      >
        {(liveEvents) => <CalendarGrid events={liveEvents} />}
      </RealtimeMergedView>
    </main>
  );
}
