"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  respondToFriendRequestAction,
  cancelFriendRequestAction,
  removeFriendAction,
} from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

// Shared by all three rows below: on a successful response the row swaps its
// controls for a brief confirmation, then calls router.refresh() itself
// after a beat — see the "no revalidatePath in the action" comment in
// ./actions.ts for why the refresh has to be client-driven and delayed
// rather than bundled into the action's own response.
function useDelayedRefreshOnSuccess(done: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!done) return;
    const timeout = setTimeout(() => router.refresh(), 900);
    return () => clearTimeout(timeout);
  }, [done, router]);
}

export function PendingRequestRow({
  friendshipId,
  requesterUsername,
}: {
  friendshipId: string;
  requesterUsername: string;
}) {
  const [state, formAction] = useActionState(respondToFriendRequestAction, null);
  const error = state && !state.ok ? state.error : undefined;
  const done = state?.ok === true;
  useDelayedRefreshOnSuccess(done);

  if (done) {
    return (
      <li className="flex items-center justify-between gap-4 py-3.5 first:pt-2.5 last:pb-2.5">
        <span className="text-sm font-medium text-foreground">{requesterUsername}</span>
        <span role="status" className="text-sm text-muted">
          {state.accepted ? "Accepted" : "Declined"}
        </span>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 py-3.5 first:pt-2.5 last:pb-2.5">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-foreground">{requesterUsername}</span>
        <div className="flex gap-2">
          <form action={formAction}>
            <input type="hidden" name="friendshipId" value={friendshipId} />
            <input type="hidden" name="accept" value="true" />
            <SubmitButton
              pendingText="Accepting…"
              aria-label={`Accept request from ${requesterUsername}`}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-[var(--shadow-soft)] transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:opacity-90 hover:shadow-[var(--shadow-lifted)] disabled:opacity-50"
            >
              Accept
            </SubmitButton>
          </form>
          <form action={formAction}>
            <input type="hidden" name="friendshipId" value={friendshipId} />
            <input type="hidden" name="accept" value="false" />
            <SubmitButton
              pendingText="Declining…"
              aria-label={`Decline request from ${requesterUsername}`}
              className="rounded-full bg-danger-muted px-4 py-2 text-sm font-medium text-danger transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:opacity-80 disabled:opacity-50"
            >
              Decline
            </SubmitButton>
          </form>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </li>
  );
}

export function SentRequestRow({
  friendshipId,
  recipientUsername,
}: {
  friendshipId: string;
  recipientUsername: string;
}) {
  const [state, formAction] = useActionState(cancelFriendRequestAction, null);
  const error = state && !state.ok ? state.error : undefined;
  const done = state?.ok === true;
  useDelayedRefreshOnSuccess(done);

  if (done) {
    return (
      <li className="flex items-center justify-between gap-4 py-3.5 first:pt-2.5 last:pb-2.5">
        <span className="text-sm text-foreground">{recipientUsername}</span>
        <span role="status" className="text-sm text-muted">
          Cancelled
        </span>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 py-3.5 first:pt-2.5 last:pb-2.5">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-foreground">
          {recipientUsername} <span className="text-muted">— awaiting response</span>
        </span>
        <form action={formAction}>
          <input type="hidden" name="friendshipId" value={friendshipId} />
          <SubmitButton
            pendingText="Cancelling…"
            aria-label={`Cancel request to ${recipientUsername}`}
            className="rounded-full bg-surface-muted px-4 py-2 text-sm font-medium text-muted transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </SubmitButton>
        </form>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </li>
  );
}

export function FriendRow({
  friendshipId,
  friendUsername,
}: {
  friendshipId: string;
  friendUsername: string;
}) {
  const [state, formAction] = useActionState(removeFriendAction, null);
  const error = state && !state.ok ? state.error : undefined;
  const done = state?.ok === true;
  useDelayedRefreshOnSuccess(done);

  if (done) {
    return (
      <li className="flex items-center justify-between gap-4 py-3.5 text-sm font-medium text-foreground first:pt-2.5 last:pb-2.5">
        {friendUsername}
        <span role="status" className="text-sm font-normal text-muted">
          Removed
        </span>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 py-3.5 first:pt-2.5 last:pb-2.5">
      <div className="flex items-center justify-between gap-4 text-sm font-medium text-foreground">
        {friendUsername}
        <form action={formAction}>
          <input type="hidden" name="friendshipId" value={friendshipId} />
          <ConfirmSubmitButton
            confirmMessage={`Remove ${friendUsername ?? "this friend"}? They'll stop seeing your shared calendars, and you'll stop seeing theirs.`}
            confirmLabel="Yes, remove"
            variant="danger"
            pendingText="Removing…"
            aria-label={`Remove ${friendUsername}`}
            className="rounded-full bg-danger-muted px-4 py-2 text-sm font-medium text-danger transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:opacity-80 disabled:opacity-50"
          >
            Remove
          </ConfirmSubmitButton>
        </form>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
