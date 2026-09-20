"use client";

import { useActionState } from "react";
import { setUsername, type SetUsernameState } from "./actions";

const initialState: SetUsernameState = { ok: true };

export function OnboardingForm() {
  const [state, formAction, isPending] = useActionState(setUsername, initialState);
  const error = state.ok ? undefined : state.error;

  return (
    <form action={formAction} className="flex w-full max-w-xs flex-col gap-3">
      <div className="flex flex-col gap-1.5">
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
          className={`rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent ${
            error ? "border-danger" : "border-border"
          }`}
        />
        <p className="text-xs text-muted">
          Letters, numbers, and underscores only — this is how friends will find you.
        </p>
        {error && (
          <p id="username-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
