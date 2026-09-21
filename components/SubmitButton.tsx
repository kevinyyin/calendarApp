"use client";

import { useFormStatus } from "react-dom";

// Reads pending state from the nearest ancestor <form action={...}>, so any
// existing server-action form gets a disabled + relabeled button the instant
// it's submitted without changing the action itself. Disabling the button
// also stops a second click from resubmitting before the first request
// finishes, not just hiding the visual lag.
export function SubmitButton({
  children,
  pendingText,
  ...rest
}: {
  children: React.ReactNode;
  pendingText: string;
} & Omit<React.ComponentPropsWithoutRef<"button">, "type" | "disabled" | "children">) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} {...rest}>
      {pending ? pendingText : children}
    </button>
  );
}
