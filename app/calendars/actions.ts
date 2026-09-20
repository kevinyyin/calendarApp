"use server";

import { db } from "@/db/client";
import { googleCalendars, watchChannels } from "@/db/schema";
import { auth } from "@/lib/auth";
import { listGoogleCalendars } from "@/lib/google-calendar";
import { runInitialSync } from "@/lib/sync";
import { registerWatchChannel, stopWatchChannel } from "@/lib/google-watch";
import { getFreshAccessToken } from "@/lib/google-token";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getMyGoogleCalendars() {
  const session = await auth();
  if (!session?.user?.id) return [];
  // The access token is fetched (and refreshed if stale) server-side rather
  // than read off the session: session objects are serialized to the browser
  // by Auth.js's /api/auth/session endpoint, so a Google access token must
  // never live on one — see lib/auth.ts.
  const accessToken = await getFreshAccessToken(session.user.id);
  return listGoogleCalendars(accessToken);
}

export async function getSharedCalendarIds(userId: string) {
  const rows = await db
    .select({ googleCalendarId: googleCalendars.googleCalendarId })
    .from(googleCalendars)
    .where(and(eq(googleCalendars.userId, userId), eq(googleCalendars.isShared, true)));
  return new Set(rows.map((r) => r.googleCalendarId));
}

export async function toggleShareCalendar(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;

  const googleCalendarId = String(formData.get("googleCalendarId"));
  const displayName = String(formData.get("displayName"));
  const color = String(formData.get("color"));
  const enable = formData.get("enable") === "true";

  const existing = await db
    .select()
    .from(googleCalendars)
    .where(
      and(
        eq(googleCalendars.userId, session.user.id),
        eq(googleCalendars.googleCalendarId, googleCalendarId),
      ),
    );

  if (existing.length === 0) {
    await db.insert(googleCalendars).values({
      userId: session.user.id,
      googleCalendarId,
      displayName,
      color,
      isShared: enable,
    });
  } else {
    await db
      .update(googleCalendars)
      .set({ isShared: enable })
      .where(eq(googleCalendars.id, existing[0].id));
  }

  const [calendarRow] = await db
    .select()
    .from(googleCalendars)
    .where(
      and(
        eq(googleCalendars.userId, session.user.id),
        eq(googleCalendars.googleCalendarId, googleCalendarId),
      ),
    );

  // Server-side only, and refreshed if the stored token has gone stale —
  // never `session.accessToken`, which would put a live Google credential in
  // the browser-visible session payload.
  const accessToken = await getFreshAccessToken(session.user.id);

  if (enable) {
    const syncedSuccessfully = await runInitialSync(calendarRow.id, accessToken);
    // If the initial sync bailed out (expired/revoked token), the calendar's
    // syncToken was never written. Registering a watch channel for it anyway
    // would let a webhook fire later and crash runIncrementalSync, which
    // requires a syncToken to already exist. The calendar is still marked
    // isShared above, and the reconnect banner (set by runInitialSync via
    // markNeedsReconnect) already tells the user what to do — no need to
    // also throw here, just skip watch-channel registration.
    if (syncedSuccessfully) {
      const webhookUrl = `${process.env.APP_URL}/api/webhooks/google-calendar`;
      // Push-notification channels are best-effort. Google only accepts a
      // watch `address` on a domain verified in the project's Search Console,
      // which a *.vercel.app preview/production domain generally is not — so
      // this call failing is an expected production condition, not a bug. By
      // this point the calendar is already marked shared AND fully synced, so
      // throwing here would show the user a server-action crash for work that
      // actually succeeded. The hourly reconciliation sweep
      // (app/api/cron/reconcile-sync) is the designed fallback for exactly
      // this case, so log loudly and carry on.
      try {
        const channel = await registerWatchChannel(
          accessToken,
          googleCalendarId,
          webhookUrl,
        );
        await db.insert(watchChannels).values({
          googleCalendarRowId: calendarRow.id,
          channelId: channel.channelId,
          resourceId: channel.resourceId,
          expiresAt: channel.expiresAt,
        });
      } catch (err) {
        console.error(
          `[watch-channel] Failed to register a Google push channel for calendar row ${calendarRow.id} (google calendar ${googleCalendarId}, webhook ${webhookUrl}). The calendar is shared and synced; it will stay up to date via the hourly reconciliation sweep instead:`,
          err,
        );
      }
    }
  } else {
    const [existingChannel] = await db
      .select()
      .from(watchChannels)
      .where(eq(watchChannels.googleCalendarRowId, calendarRow.id));
    if (existingChannel) {
      await stopWatchChannel(
        accessToken,
        existingChannel.channelId,
        existingChannel.resourceId,
      );
      await db.delete(watchChannels).where(eq(watchChannels.id, existingChannel.id));
    }
  }

  revalidatePath("/calendars");
}
