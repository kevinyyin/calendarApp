import { db } from "@/db/client";
import { events, googleCalendars, mergedViewPrefs } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getVisibleCalendars } from "@/lib/visibility";

export async function getMergedViewEvents(
  viewerId: string,
  range: { start: Date; end: Date },
) {
  // The viewer's own calendars are always visible to the viewer, regardless
  // of `isShared` (that flag gates what FRIENDS can see of this user's
  // calendars — it has nothing to do with what the user can see of their own
  // data). Fetch them directly rather than going through
  // `getVisibleCalendars`, which is friends-only by design.
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

  // `merged_view_prefs` toggles only ever target a `friendId` — a viewer
  // can't hide themselves from their own merged view — so the hidden-friend
  // filter applies to friend calendars only, never to the viewer's own.
  const visibleFriendCalendars = friendCalendars.filter(
    (cal) => !hiddenFriendIds.has(cal.userId),
  );

  const visibleAfterToggle = [...ownCalendars, ...visibleFriendCalendars];

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
