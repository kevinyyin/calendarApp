import { db } from "@/db/client";
import { events, googleCalendars } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { GoogleEvent } from "@/lib/google-calendar-events";
import { fetchAllGoogleEvents } from "@/lib/google-calendar-events";

function toEventRow(googleCalendarRowId: string, event: GoogleEvent) {
  const isAllDay = Boolean(event.start?.date);
  return {
    googleCalendarRowId,
    googleEventId: event.id!,
    title: event.summary ?? null,
    description: event.description ?? null,
    location: event.location ?? null,
    startAt: new Date((event.start?.dateTime ?? event.start?.date)!),
    endAt: new Date((event.end?.dateTime ?? event.end?.date)!),
    isAllDay,
    status: event.status ?? "confirmed",
    updatedAt: new Date(),
  };
}

export async function upsertEventsFromGoogle(
  googleCalendarRowId: string,
  googleEvents: GoogleEvent[],
) {
  for (const event of googleEvents) {
    const row = toEventRow(googleCalendarRowId, event);
    if (row.status === "cancelled") {
      // Scoped to this calendar row, not just googleEventId: the whole
      // reason for the composite unique index is that google_event_id is
      // only unique per calendar, so deleting by googleEventId alone could
      // remove another calendar's event that happens to share the same id.
      await db
        .delete(events)
        .where(
          and(
            eq(events.googleCalendarRowId, row.googleCalendarRowId),
            eq(events.googleEventId, row.googleEventId),
          ),
        );
      continue;
    }
    await db
      .insert(events)
      .values(row)
      .onConflictDoUpdate({
        target: [events.googleCalendarRowId, events.googleEventId],
        set: {
          title: row.title,
          description: row.description,
          location: row.location,
          startAt: row.startAt,
          endAt: row.endAt,
          isAllDay: row.isAllDay,
          status: row.status,
          updatedAt: row.updatedAt,
        },
      });
  }
}

export async function runInitialSync(calendarRowId: string, accessToken: string) {
  const [calendarRow] = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.id, calendarRowId));
  if (!calendarRow) throw new Error(`Unknown calendar row ${calendarRowId}`);

  const { items, nextSyncToken } = await fetchAllGoogleEvents(
    accessToken,
    calendarRow.googleCalendarId,
  );

  await upsertEventsFromGoogle(calendarRowId, items);

  await db
    .update(googleCalendars)
    .set({ syncToken: nextSyncToken, lastSyncedAt: new Date() })
    .where(eq(googleCalendars.id, calendarRowId));
}
