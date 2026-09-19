"use server";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export function validateUsername(
  username: string,
): { ok: true } | { ok: false; error: string } {
  if (username.length < 3) {
    return { ok: false, error: "Username must be at least 3 characters" };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return {
      ok: false,
      error: "Username can only contain letters, numbers, and underscores",
    };
  }
  return { ok: true };
}

export async function setUsername(formData: FormData) {
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
