"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setUsername } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function OnboardingForm() {
  const router = useRouter();
  // Initial state is `null`, not `{ok:true}`: the effect below redirects on
  // a successful submission, and keying that off `state?.ok` (rather than
  // `state.ok` on a truthy default) means it only fires after `formAction`
  // actually runs once — not on first render, before the user has done
  // anything.
  const [state, formAction] = useActionState(setUsername, null);
  const error = state && !state.ok ? state.error : undefined;

  useEffect(() => {
    if (state?.ok) router.push("/");
  }, [state, router]);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="username" className="text-sm font-medium text-foreground">
          Choose a username
        </label>
        <input
          id="username"
          name="username"
          required
          minLength={3}
          pattern="[a-zA-Z0-9_]+"
          autoComplete="off"
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "username-error" : undefined}
          className={`rounded-xl border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-accent ${
            error ? "border-danger" : "border-border"
          }`}
        />
        <p className="text-xs leading-relaxed text-muted">
          Letters, numbers, and underscores only — this is how friends will find you.
        </p>
        {error && (
          <p id="username-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <SubmitButton
        pendingText="Saving…"
        className="rounded-full bg-accent px-5 py-3 text-sm font-medium text-accent-foreground shadow-[var(--shadow-soft)] transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:opacity-90 hover:shadow-[var(--shadow-lifted)] disabled:opacity-50"
      >
        Continue
      </SubmitButton>
    </form>
  );
}
