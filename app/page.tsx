import { auth } from "@/lib/auth";
import { getMergedViewEvents } from "@/lib/merged-view";
import { getVisibleCalendars } from "@/lib/visibility";
import { CalendarGrid } from "@/components/CalendarGrid";
import { toggleFriendVisibility } from "@/app/actions/merged-view";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [events, visibleCalendars] = await Promise.all([
    getMergedViewEvents(session.user.id, { start: now, end: weekFromNow }),
    getVisibleCalendars(session.user.id),
  ]);

  const friendsByUserId = new Map(
    visibleCalendars.map((c) => [c.userId, c.displayName]),
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
      <CalendarGrid events={events} />
    </main>
  );
}
