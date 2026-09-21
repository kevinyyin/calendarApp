"use server";

import { auth } from "@/lib/auth";
import {
  sendFriendRequest as sendFriendRequestLib,
  respondToFriendRequest as respondLib,
  cancelFriendRequest as cancelFriendRequestLib,
  removeFriendship as removeFriendshipLib,
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
  const username = String(formData.get("username")).trim();
  const result = await sendFriendRequestLib(session.user.id, username);
  if (result.ok) {
    revalidatePath("/friends");
  }
  return result;
}

export type RespondState = { ok: true; accepted: boolean } | { ok: false; error: string };

// Same (prevState, formData) shape as sendFriendRequestAction, for the same
// reason: respondLib's {ok:false, error} (e.g. "That friend request has
// already been answered", hit by a double-click or a stale tab) was
// previously discarded outright. Deliberately does NOT revalidatePath here —
// the row's own client component shows the accepted/declined confirmation
// first and triggers the refresh itself after a beat, since a revalidate
// bundled into this response would remove the row from the list in the same
// transition as the success state, before it could ever be seen.
export async function respondToFriendRequestAction(
  _prevState: RespondState | null,
  formData: FormData,
): Promise<RespondState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const friendshipId = String(formData.get("friendshipId"));
  const accept = formData.get("accept") === "true";
  const result = await respondLib(friendshipId, session.user.id, accept);
  return result.ok ? { ok: true, accepted: accept } : result;
}

export type SimpleActionState = { ok: true } | { ok: false; error: string };

// See respondToFriendRequestAction above: no revalidatePath here either, for
// the same row-visibility reason.
export async function cancelFriendRequestAction(
  _prevState: SimpleActionState | null,
  formData: FormData,
): Promise<SimpleActionState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const friendshipId = String(formData.get("friendshipId"));
  return cancelFriendRequestLib(friendshipId, session.user.id);
}

// See respondToFriendRequestAction above: no revalidatePath here either, for
// the same row-visibility reason.
export async function removeFriendAction(
  _prevState: SimpleActionState | null,
  formData: FormData,
): Promise<SimpleActionState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const friendshipId = String(formData.get("friendshipId"));
  return removeFriendshipLib(friendshipId, session.user.id);
}
