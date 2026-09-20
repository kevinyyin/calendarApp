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

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold">This week</h1>
      <div className="mb-6 flex gap-2">
        {[...friendsByUserId.entries()].map(([friendId, label]) => (
          <form key={friendId} action={toggleFriendVisibility}>
            <input type="hidden" name="friendId" value={friendId} />
            <input type="hidden" name="visible" value="false" />
            <button type="submit" className="rounded bg-slate-100 px-3 py-1 text-sm">
              Hide {label}
            </button>
          </form>
        ))}
      </div>
      <RealtimeMergedView
        initialEvents={events}
        calendarMetaByRowId={calendarMetaByRowId}
      >
        {(liveEvents) => <CalendarGrid events={liveEvents} />}
      </RealtimeMergedView>
    </main>
  );
}
