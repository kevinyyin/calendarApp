"use server";

import { db } from "@/db/client";
import { googleCalendars } from "@/db/schema";
import { auth } from "@/lib/auth";
import { listGoogleCalendars } from "@/lib/google-calendar";
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

  revalidatePath("/calendars");
}
