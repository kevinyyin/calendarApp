"use server";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { validateUsername } from "./validate-username";

export type SetUsernameState = { ok: true } | { ok: false; error: string };

// Signature is (prevState, formData) rather than plain (formData) so the
// onboarding form can drive it through React's useActionState and surface
// validateUsername's/the "username taken" error message to the user instead
// of silently discarding it (see app/onboarding/OnboardingForm.tsx).
// setUsername is only ever called from that form, so widening its signature
// doesn't touch any other caller.
export async function setUsername(
  _prevState: SetUsernameState | null,
  formData: FormData,
): Promise<SetUsernameState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const username = String(formData.get("username") ?? "").trim();
  const validation = validateUsername(username);
  if (!validation.ok) {
    return validation;
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, username));
  if (existing.length > 0) {
    return { ok: false as const, error: "Username is already taken" };
  }

  await db
    .update(users)
    .set({ username })
    .where(eq(users.id, session.user.id));

  redirect("/");
}
