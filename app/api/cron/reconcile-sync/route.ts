import { db } from "@/db/client";
import { googleCalendars } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runIncrementalSync } from "@/lib/sync";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sharedCalendars = await db
    .select({ id: googleCalendars.id })
    .from(googleCalendars)
    .where(eq(googleCalendars.isShared, true));

  let succeeded = 0;
  let failed = 0;

  for (const cal of sharedCalendars) {
    try {
      await runIncrementalSync(cal.id);
      succeeded++;
    } catch (err) {
      // Isolate failures per-calendar: one calendar that fails to
      // reconcile (revoked grant, transient Google API error, etc.)
      // shouldn't stop the rest of this run's calendars from being swept.
      console.error(`Reconciliation sync failed for calendar ${cal.id}`, err);
      failed++;
    }
  }

  return NextResponse.json({ succeeded, failed }, { status: 200 });
}
