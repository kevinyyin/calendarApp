"use client";

import { useActionState } from "react";
import { setUsername } from "@/app/onboarding/actions";
import { SubmitButton } from "@/components/SubmitButton";

export function UsernameForm({ currentUsername }: { currentUsername: string | null }) {
  const [state, formAction] = useActionState(setUsername, null);
  const error = state && !state.ok ? state.error : undefined;
  const saved = state?.ok === true;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
      <form action={formAction} className="flex flex-col gap-2.5">
        <label htmlFor="own-username" className="text-sm font-medium text-foreground">
          Your username
        </label>
        <input
          id="own-username"
          name="username"
          defaultValue={currentUsername ?? ""}
          required
          minLength={3}
          pattern="[a-zA-Z0-9_]+"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "own-username-error" : undefined}
          className={`min-w-0 rounded-xl border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-accent ${
            error ? "border-danger" : "border-border"
          }`}
        />
        <SubmitButton
          pendingText="Saving…"
          className="w-fit rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-[var(--shadow-soft)] transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:opacity-90 hover:shadow-[var(--shadow-lifted)] disabled:opacity-50"
        >
          Save
        </SubmitButton>
        <p className="text-xs leading-relaxed text-muted">
          {currentUsername
            ? "This is how friends find you to send a request."
            : "Set a username so friends can find you — without one, nobody can send you a request."}
        </p>
        {error && (
          <p id="own-username-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {saved && !error && (
          <p role="status" className="text-sm text-success">
            Saved.
          </p>
        )}
      </form>
    </div>
  );
}
