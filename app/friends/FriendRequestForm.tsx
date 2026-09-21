"use client";

import { useActionState, useRef, useEffect } from "react";
import { sendFriendRequestAction, type SendFriendRequestState } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

const initialState: SendFriendRequestState = { ok: true };

export function FriendRequestForm() {
  const [state, formAction] = useActionState(sendFriendRequestAction, initialState);
  const error = state.ok ? undefined : state.error;
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the input after a successful request so it doesn't look like the
  // (now-stale) username is still queued to be sent again.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-foreground">Add a friend</h2>
      <form ref={formRef} action={formAction} className="flex gap-2.5">
        <label htmlFor="friend-request-username" className="sr-only">
          Username
        </label>
        <input
          id="friend-request-username"
          name="username"
          placeholder="username"
          required
          minLength={3}
          pattern="[a-zA-Z0-9_]+"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "friend-request-error" : undefined}
          className={`flex-1 rounded-xl border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-accent ${
            error ? "border-danger" : "border-border"
          }`}
        />
        <SubmitButton
          pendingText="Sending…"
          className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-[var(--shadow-soft)] transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:opacity-90 hover:shadow-[var(--shadow-lifted)] disabled:opacity-50"
        >
          Send request
        </SubmitButton>
      </form>
      {error && (
        <p id="friend-request-error" role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
