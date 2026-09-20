import { db } from "@/db/client";
import { accounts, events, googleCalendars } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { GoogleEvent } from "@/lib/google-calendar-events";
import { fetchAllGoogleEvents, fetchIncrementalGoogleEvents } from "@/lib/google-calendar-events";
import { decryptAccountTokens } from "@/lib/auth-adapter";

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

async function getAccessTokenForCalendarOwner(userId: string): Promise<string> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));
  if (!account) throw new Error(`No linked Google account for user ${userId}`);
  const { accessToken } = decryptAccountTokens(account);
  if (!accessToken) throw new Error(`No access token for user ${userId}`);
  return accessToken;
}

export async function runIncrementalSync(calendarRowId: string) {
  const [calendarRow] = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.id, calendarRowId));
  if (!calendarRow) throw new Error(`Unknown calendar row ${calendarRowId}`);
  if (!calendarRow.syncToken) {
    throw new Error(`Calendar ${calendarRowId} has no sync token; run initial sync first`);
  }

  const accessToken = await getAccessTokenForCalendarOwner(calendarRow.userId);

  try {
    const { items, nextSyncToken } = await fetchIncrementalGoogleEvents(
      accessToken,
      calendarRow.googleCalendarId,
      calendarRow.syncToken,
    );
    await upsertEventsFromGoogle(calendarRowId, items);
    await db
      .update(googleCalendars)
      .set({ syncToken: nextSyncToken, lastSyncedAt: new Date() })
      .where(eq(googleCalendars.id, calendarRowId));
  } catch (err) {
    // Google returns HTTP 410 Gone when a sync token has expired or become
    // invalid, signaling the client must discard it and start over with a
    // full resync — see
    // https://developers.google.com/calendar/api/guides/sync#full_sync_required_by_server
    const isSyncTokenExpired =
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: unknown }).code === 410;
    if (isSyncTokenExpired) {
      await runInitialSync(calendarRowId, accessToken);
      return;
    }
    throw err;
  }
}
