import { db } from "@/db/client";
import { watchChannels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runIncrementalSync } from "@/lib/sync";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const channelId = req.headers.get("x-goog-channel-id");
  if (!channelId) {
    return NextResponse.json({ error: "missing channel id" }, { status: 400 });
  }

  const [channel] = await db
    .select()
    .from(watchChannels)
    .where(eq(watchChannels.channelId, channelId));

  if (!channel) {
    return NextResponse.json({ error: "unknown channel" }, { status: 404 });
  }

  await runIncrementalSync(channel.googleCalendarRowId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
