"use server";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { validateUsername } from "./validate-username";

export type SetUsernameState = { ok: true } | { ok: false; error: string };

// Signature is (prevState, formData) rather than plain (formData) so callers
// can drive it through React's useActionState and surface validateUsername's/
// the "username taken" error message to the user instead of silently
// discarding it. Shared by two callers — app/onboarding/OnboardingForm.tsx
// (first-time set) and app/friends/UsernameForm.tsx (view/change anytime) —
// so it does its own DB write and revalidation but leaves post-success
// navigation to each caller rather than redirecting itself.
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

  // Excludes the current user's own row: without this, re-saving your own
  // unchanged username (e.g. clicking "Save" on the Friends page without
  // editing the field) would find your own existing row and reject it as
  // "already taken."
  const existing = await db
    .select()
    .from(users)
    .where(and(eq(users.username, username), ne(users.id, session.user.id)));
  if (existing.length > 0) {
    return { ok: false as const, error: "Username is already taken" };
  }

  await db
    .update(users)
    .set({ username })
    .where(eq(users.id, session.user.id));

  revalidatePath("/friends");
  return { ok: true };
}
