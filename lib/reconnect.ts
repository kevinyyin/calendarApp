import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function markNeedsReconnect(userId: string) {
  await db.update(users).set({ needsReconnect: true }).where(eq(users.id, userId));
}

export async function clearNeedsReconnect(userId: string) {
  await db.update(users).set({ needsReconnect: false }).where(eq(users.id, userId));
}
