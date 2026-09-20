import { db } from "@/db/client";
import { googleCalendars } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAcceptedFriendIds } from "@/lib/friendships";

export async function getVisibleCalendars(viewerId: string) {
  const friendIds = await getAcceptedFriendIds(viewerId);
  if (friendIds.length === 0) return [];

  const friendIdSet = new Set(friendIds);
  const allShared = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.isShared, true));

  return allShared.filter((cal) => friendIdSet.has(cal.userId));
}
