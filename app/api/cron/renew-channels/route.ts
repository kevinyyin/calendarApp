import { db } from "@/db/client";
import { watchChannels, googleCalendars, accounts } from "@/db/schema";
import { eq, lt, sql } from "drizzle-orm";
import { registerWatchChannel, stopWatchChannel } from "@/lib/google-watch";
import { decryptAccountTokens } from "@/lib/auth-adapter";
import { NextResponse } from "next/server";

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const expiringSoon = new Date(Date.now() + ONE_DAY_MS);

  // The (encrypted) access token is correlated in via a scalar subquery
  // (rather than a second `.innerJoin`) so this stays a single joined query:
  // watch channels only reference their calendar row, and the owning
  // account is reached through that calendar's `userId`.
  const rows = await db
    .select({
      watchChannel: watchChannels,
      googleCalendarId: googleCalendars.googleCalendarId,
      accessToken: sql<string | null>`(
        select ${accounts.access_token} from ${accounts}
        where ${accounts.userId} = ${googleCalendars.userId}
        limit 1
      )`,
    })
    .from(watchChannels)
    .innerJoin(googleCalendars, eq(watchChannels.googleCalendarRowId, googleCalendars.id))
    .where(lt(watchChannels.expiresAt, expiringSoon));

  const webhookUrl = `${process.env.APP_URL}/api/webhooks/google-calendar`;
  let renewed = 0;

  for (const row of rows) {
    if (!row.accessToken) continue;

    // `row.accessToken` is the raw (encrypted-at-rest) `accounts.access_token`
    // column value — see `lib/auth-adapter.ts`'s `withEncryptedTokens` — so it
    // must be decrypted before it can be used as a real OAuth bearer token.
    const { accessToken } = decryptAccountTokens({ access_token: row.accessToken });
    if (!accessToken) continue;

    try {
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
      ).catch(() => {});

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
