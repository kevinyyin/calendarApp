import { db } from "@/db/client";
import { events, mergedViewPrefs } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getVisibleCalendars } from "@/lib/visibility";

export async function getMergedViewEvents(
  viewerId: string,
  range: { start: Date; end: Date },
) {
  const visibleCalendars = await getVisibleCalendars(viewerId);

  const prefs = await db
    .select()
    .from(mergedViewPrefs)
    .where(eq(mergedViewPrefs.viewerId, viewerId));
  const hiddenFriendIds = new Set(
    prefs.filter((p) => !p.isVisible).map((p) => p.friendId),
  );

  const visibleAfterToggle = visibleCalendars.filter(
    (cal) => !hiddenFriendIds.has(cal.userId),
  );

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
