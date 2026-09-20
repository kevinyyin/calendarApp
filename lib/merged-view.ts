import { db } from "@/db/client";
import { events, googleCalendars, mergedViewPrefs } from "@/db/schema";
import { eq, and, lt, gt } from "drizzle-orm";
import { getVisibleCalendars } from "@/lib/visibility";

// The set of calendars relevant to a viewer's merged view: their own
// calendars (always visible to themselves, regardless of `isShared` — that
// flag only gates what FRIENDS can see of this user's calendars) plus
// friends' shared calendars, with any friend the viewer has hidden via
// `merged_view_prefs` filtered out. `merged_view_prefs` toggles only ever
// target a `friendId` — a viewer can't hide themselves from their own merged
// view — so that filter applies to friend calendars only, never the
// viewer's own.
/**
 * The friend ids this viewer has toggled off in their merged view.
 *
 * Exported because the UI needs it too: app/page.tsx renders a "Hide
 * {friend}" or "Show {friend}" button per friend depending on the current
 * state, and without reading it there the button could only ever submit
 * `visible="false"` — leaving a hidden friend unhideable outside the DB.
 */
export async function getHiddenFriendIds(viewerId: string): Promise<Set<string>> {
  const prefs = await db
    .select()
    .from(mergedViewPrefs)
    .where(eq(mergedViewPrefs.viewerId, viewerId));

  return new Set(prefs.filter((p) => !p.isVisible).map((p) => p.friendId));
}

export async function getRelevantCalendarsForViewer(viewerId: string) {
  const ownCalendars = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.userId, viewerId));

  const friendCalendars = await getVisibleCalendars(viewerId);

  const hiddenFriendIds = await getHiddenFriendIds(viewerId);

  const visibleFriendCalendars = friendCalendars.filter(
    (cal) => !hiddenFriendIds.has(cal.userId),
  );

  return [...ownCalendars, ...visibleFriendCalendars];
}

export async function getMergedViewEvents(
  viewerId: string,
  range: { start: Date; end: Date },
) {
  const visibleAfterToggle = await getRelevantCalendarsForViewer(viewerId);

  const results = [];
  for (const cal of visibleAfterToggle) {
    const rows = await db
      .select()
      .from(events)
      .where(
        // OVERLAP, not containment. `startAt >= range.start AND endAt <=
        // range.end` silently dropped every event crossing a boundary — a
        // 23:00→01:00 event on the view's first day, or any multi-day one —
        // even though the person is genuinely busy during the part that
        // falls inside the range. The comparisons are strict so an event
        // that merely touches a boundary (endAt == range.start) isn't
        // counted: a zero-length intersection is not an overlap.
        and(
          eq(events.googleCalendarRowId, cal.id),
          lt(events.startAt, range.end),
          gt(events.endAt, range.start),
        ),
      );
    for (const row of rows) {
      results.push({
        id: row.id,
        googleCalendarRowId: cal.id,
        personUserId: cal.userId,
        personLabel: cal.displayName,
        color: cal.color,
        title: row.title ?? "(untitled)",
        startAt: row.startAt!,
        endAt: row.endAt!,
      });
    }
  }
  return results;
}
