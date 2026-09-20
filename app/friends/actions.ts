"use server";

import { auth } from "@/lib/auth";
import {
  sendFriendRequest as sendFriendRequestLib,
  respondToFriendRequest as respondLib,
} from "@/lib/friendships";
import { revalidatePath } from "next/cache";

export async function sendFriendRequestAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const username = String(formData.get("username"));
  await sendFriendRequestLib(session.user.id, username);
  revalidatePath("/friends");
}

export async function respondToFriendRequestAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const friendshipId = String(formData.get("friendshipId"));
  const accept = formData.get("accept") === "true";
  await respondLib(friendshipId, session.user.id, accept);
  revalidatePath("/friends");
}
