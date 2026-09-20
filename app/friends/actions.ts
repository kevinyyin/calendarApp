"use server";

import { auth } from "@/lib/auth";
import {
  sendFriendRequest as sendFriendRequestLib,
  respondToFriendRequest as respondLib,
} from "@/lib/friendships";
import { revalidatePath } from "next/cache";

export type SendFriendRequestState = { ok: true } | { ok: false; error: string };

// Signature is (prevState, formData) rather than plain (formData) so the
// "send request" form can drive it through useActionState and surface
// sendFriendRequestLib's {ok:false, error} result (e.g. "No user found with
// that username") to the user instead of silently discarding it, the same
// gap fixed for app/onboarding/actions.ts:setUsername. Only called from
// app/friends/FriendRequestForm.tsx, so widening the signature is safe.
export async function sendFriendRequestAction(
  _prevState: SendFriendRequestState | null,
  formData: FormData,
): Promise<SendFriendRequestState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const username = String(formData.get("username"));
  const result = await sendFriendRequestLib(session.user.id, username);
  if (result.ok) {
    revalidatePath("/friends");
  }
  return result;
}

export async function respondToFriendRequestAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const friendshipId = String(formData.get("friendshipId"));
  const accept = formData.get("accept") === "true";
  await respondLib(friendshipId, session.user.id, accept);
  revalidatePath("/friends");
}
