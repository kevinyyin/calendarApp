import { db } from "@/db/client";
import { watchChannels, googleCalendars } from "@/db/schema";
import { eq, lt } from "drizzle-orm";
import { registerWatchChannel, stopWatchChannel } from "@/lib/google-watch";
import { getFreshAccessToken } from "@/lib/google-token";
import { NextResponse } from "next/server";

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const expiringSoon = new Date(Date.now() + ONE_DAY_MS);

  // The calendar owner's `userId` is joined in (rather than their stored
  // access token) because the stored token can't be trusted to still be
  // valid: Auth.js only writes `accounts.access_token` on a user's first
  // sign-in, so it goes stale within the hour. `getFreshAccessToken` below
  // refreshes it against Google when needed — see lib/google-token.ts.
  const rows = await db
    .select({
      watchChannel: watchChannels,
      googleCalendarId: googleCalendars.googleCalendarId,
      userId: googleCalendars.userId,
    })
    .from(watchChannels)
    .innerJoin(googleCalendars, eq(watchChannels.googleCalendarRowId, googleCalendars.id))
    .where(lt(watchChannels.expiresAt, expiringSoon));

  const webhookUrl = `${process.env.APP_URL}/api/webhooks/google-calendar`;
  let renewed = 0;

  for (const row of rows) {
    try {
      // Inside the per-channel try/catch: a user whose Google grant is dead
      // (getFreshAccessToken throws GoogleReconnectRequiredError, having
      // already flagged them for reconnect) must not stop other users'
      // channels in this run from being renewed.
      const accessToken = await getFreshAccessToken(row.userId);

      const fresh = await registerWatchChannel(accessToken, row.googleCalendarId, webhookUrl);

      await db.insert(watchChannels).values({
        googleCalendarRowId: row.watchChannel.googleCalendarRowId,
        channelId: fresh.channelId,
        resourceId: fresh.resourceId,
        expiresAt: fresh.expiresAt,
      });

      await stopWatchChannel(
        accessToken,
        row.watchChannel.channelId,
        row.watchChannel.resourceId,
      ).catch((err) => {
        // Best-effort: Google may already consider the old channel gone, so
        // we don't want a stop failure to block renewal. But we still log
        // so genuine failures (network errors, auth errors, unexpected
        // 5xxs) don't go unnoticed indefinitely.
        console.error(
          `Failed to stop old watch channel ${row.watchChannel.channelId} (calendar row ${row.watchChannel.googleCalendarRowId}):`,
          err,
        );
      });

      await db.delete(watchChannels).where(eq(watchChannels.id, row.watchChannel.id));

      renewed++;
    } catch (err) {
      // Isolate failures per-channel: one channel that can't be renewed
      // (revoked grant, transient Google API error, etc.) shouldn't stop the
      // rest of this run's channels from being renewed.
      console.error(`Failed to renew watch channel ${row.watchChannel.id}:`, err);
    }
  }

  return NextResponse.json({ renewed }, { status: 200 });
}
