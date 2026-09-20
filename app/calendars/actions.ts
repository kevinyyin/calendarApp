"use server";

import { db } from "@/db/client";
import { googleCalendars, watchChannels } from "@/db/schema";
import { auth } from "@/lib/auth";
import { listGoogleCalendars } from "@/lib/google-calendar";
import { runInitialSync } from "@/lib/sync";
import { registerWatchChannel, stopWatchChannel } from "@/lib/google-watch";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getMyGoogleCalendars() {
  const session = await auth();
  if (!session?.user?.id || !session.accessToken) return [];
  return listGoogleCalendars(session.accessToken);
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

  if (enable && session.accessToken) {
    await runInitialSync(calendarRow.id, session.accessToken);
    const webhookUrl = `${process.env.APP_URL}/api/webhooks/google-calendar`;
    const channel = await registerWatchChannel(
      session.accessToken,
      googleCalendarId,
      webhookUrl,
    );
    await db.insert(watchChannels).values({
      googleCalendarRowId: calendarRow.id,
      channelId: channel.channelId,
      resourceId: channel.resourceId,
      expiresAt: channel.expiresAt,
    });
  } else if (!enable && session.accessToken) {
    const [existingChannel] = await db
      .select()
      .from(watchChannels)
      .where(eq(watchChannels.googleCalendarRowId, calendarRow.id));
    if (existingChannel) {
      await stopWatchChannel(
        session.accessToken,
        existingChannel.channelId,
        existingChannel.resourceId,
      );
      await db.delete(watchChannels).where(eq(watchChannels.id, existingChannel.id));
    }
  }

  revalidatePath("/calendars");
}
