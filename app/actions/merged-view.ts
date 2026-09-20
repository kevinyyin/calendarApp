"use server";

import { db } from "@/db/client";
import { mergedViewPrefs } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function toggleFriendVisibility(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;

  const friendId = String(formData.get("friendId"));
  const visible = formData.get("visible") === "true";

  const existing = await db
    .select()
    .from(mergedViewPrefs)
    .where(
      and(
        eq(mergedViewPrefs.viewerId, session.user.id),
        eq(mergedViewPrefs.friendId, friendId),
      ),
    );

  if (existing.length === 0) {
    await db.insert(mergedViewPrefs).values({
      viewerId: session.user.id,
      friendId,
      isVisible: visible,
    });
  } else {
    await db
      .update(mergedViewPrefs)
      .set({ isVisible: visible, updatedAt: new Date() })
      .where(
        and(
          eq(mergedViewPrefs.viewerId, session.user.id),
          eq(mergedViewPrefs.friendId, friendId),
        ),
      );
  }

  revalidatePath("/");
}
