"use client";

import { useActionState } from "react";
import { setUsername } from "@/app/onboarding/actions";
import { SubmitButton } from "@/components/SubmitButton";

export function UsernameForm({ currentUsername }: { currentUsername: string | null }) {
  const [state, formAction] = useActionState(setUsername, null);
  const error = state && !state.ok ? state.error : undefined;
  const saved = state?.ok === true;

  return (
    <div className="mb-6 rounded-lg border border-border bg-surface p-4">
      <form action={formAction} className="flex flex-col gap-1.5">
        <label htmlFor="own-username" className="text-sm font-medium text-foreground">
          Your username
        </label>
        <div className="flex gap-2">
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
            className={`flex-1 rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent ${
              error ? "border-danger" : "border-border"
            }`}
          />
          <SubmitButton
            pendingText="Saving…"
            className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Save
          </SubmitButton>
        </div>
        <p className="text-xs text-muted">
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
