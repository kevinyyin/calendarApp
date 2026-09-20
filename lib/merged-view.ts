import { db } from "@/db/client";
import { events, googleCalendars, mergedViewPrefs } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getVisibleCalendars } from "@/lib/visibility";

// The set of calendars relevant to a viewer's merged view: their own
// calendars (always visible to themselves, regardless of `isShared` — that
// flag only gates what FRIENDS can see of this user's calendars) plus
// friends' shared calendars, with any friend the viewer has hidden via
// `merged_view_prefs` filtered out. `merged_view_prefs` toggles only ever
// target a `friendId` — a viewer can't hide themselves from their own merged
// view — so that filter applies to friend calendars only, never the
// viewer's own.
export async function getRelevantCalendarsForViewer(viewerId: string) {
  const ownCalendars = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.userId, viewerId));

  const friendCalendars = await getVisibleCalendars(viewerId);

  const prefs = await db
    .select()
    .from(mergedViewPrefs)
    .where(eq(mergedViewPrefs.viewerId, viewerId));
  const hiddenFriendIds = new Set(
    prefs.filter((p) => !p.isVisible).map((p) => p.friendId),
  );

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
        and(
          eq(events.googleCalendarRowId, cal.id),
          gte(events.startAt, range.start),
          lte(events.endAt, range.end),
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
