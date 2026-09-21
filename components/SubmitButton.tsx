"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/Spinner";

// Reads pending state from the nearest ancestor <form action={...}>, so any
// existing server-action form gets a disabled + relabeled button the instant
// it's submitted without changing the action itself. Disabling the button
// also stops a second click from resubmitting before the first request
// finishes, not just hiding the visual lag.
//
// The inner <span> (not the button's own className) owns the icon+label
// layout, so every call site gets correct alignment without having to add
// `flex items-center gap-*` to its own className.
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
      <span className="inline-flex items-center gap-2">
        {pending && <Spinner className="h-3.5 w-3.5" />}
        {pending ? pendingText : children}
      </span>
    </button>
  );
}
