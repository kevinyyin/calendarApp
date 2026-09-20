import { db } from "@/db/client";
import { events, googleCalendars } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { GoogleEvent } from "@/lib/google-calendar-events";
import { fetchAllGoogleEvents, fetchIncrementalGoogleEvents } from "@/lib/google-calendar-events";
import {
  getFreshAccessToken,
  GoogleReconnectRequiredError,
} from "@/lib/google-token";

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

function isGoogleAuthError(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code?: unknown }).code
      : undefined;
  return code === 401 || code === 403;
}

// Returns `true` when the sync actually completed (events upserted and
// syncToken/lastSyncedAt written), or `false` when it bailed early because
// the access token was expired/revoked (a 401/403). Callers that chain more
// Google API calls or DB writes after this — e.g. registering a watch
// channel — must check this return value: a `false` means the calendar's
// syncToken is still whatever it was before (possibly null), so proceeding
// as if the sync succeeded can leave the system in an inconsistent state.
export async function runInitialSync(
  calendarRowId: string,
  accessToken: string,
): Promise<boolean> {
  const [calendarRow] = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.id, calendarRowId));
  if (!calendarRow) throw new Error(`Unknown calendar row ${calendarRowId}`);

  try {
    const { items, nextSyncToken } = await fetchAllGoogleEvents(
      accessToken,
      calendarRow.googleCalendarId,
    );

    await upsertEventsFromGoogle(calendarRowId, items);

    await db
      .update(googleCalendars)
      .set({ syncToken: nextSyncToken, lastSyncedAt: new Date() })
      .where(eq(googleCalendars.id, calendarRowId));

    return true;
  } catch (err) {
    // Google returns 401/403 when the stored access token has expired or the
    // user revoked this app's access — surface that as a reconnect prompt
    // instead of failing the whole sync run.
    if (isGoogleAuthError(err)) {
      const { markNeedsReconnect } = await import("@/lib/reconnect");
      await markNeedsReconnect(calendarRow.userId);
      return false;
    }
    throw err;
  }
}

// Always goes through `getFreshAccessToken` rather than reading (and
// decrypting) `accounts.access_token` directly: Auth.js only writes that
// column on a user's FIRST sign-in, so the stored value goes stale about an
// hour later and never recovers on its own — see lib/google-token.ts.
async function getAccessTokenForCalendarOwner(userId: string): Promise<string> {
  return getFreshAccessToken(userId);
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

  let accessToken: string;
  try {
    accessToken = await getAccessTokenForCalendarOwner(calendarRow.userId);
  } catch (err) {
    // A revoked/expired grant is the same user-actionable condition the
    // 401/403 handler below already covers, and `getFreshAccessToken` has
    // already set the reconnect flag — so bail quietly rather than throwing.
    // That keeps the webhook route answering 200 (a 500 makes Google retry
    // and eventually drop the channel) and keeps the reconcile cron from
    // counting a dead grant as a retryable failure. Any OTHER token failure
    // (Google outage, misconfiguration) still throws, because those SHOULD
    // be retried and SHOULD show up as failures.
    if (err instanceof GoogleReconnectRequiredError) return;
    throw err;
  }

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
    // Google returns 401/403 when the stored access token has expired or the
    // user revoked this app's access — surface that as a reconnect prompt
    // instead of failing the whole sync run.
    if (isGoogleAuthError(err)) {
      const { markNeedsReconnect } = await import("@/lib/reconnect");
      await markNeedsReconnect(calendarRow.userId);
      return;
    }
    throw err;
  }
}
