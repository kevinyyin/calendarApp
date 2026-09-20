"use client";

import { useActionState, useRef, useEffect } from "react";
import { sendFriendRequestAction, type SendFriendRequestState } from "./actions";

const initialState: SendFriendRequestState = { ok: true };

export function FriendRequestForm() {
  const [state, formAction, isPending] = useActionState(sendFriendRequestAction, initialState);
  const error = state.ok ? undefined : state.error;
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the input after a successful request so it doesn't look like the
  // (now-stale) username is still queued to be sent again.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="mb-6">
      <form ref={formRef} action={formAction} className="flex gap-2">
        <input
          name="username"
          placeholder="username"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "friend-request-error" : undefined}
          className={`flex-1 rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent ${
            error ? "border-danger" : "border-border"
          }`}
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Send request"}
        </button>
      </form>
      {error && (
        <p id="friend-request-error" role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
