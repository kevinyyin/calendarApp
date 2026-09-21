"use client";

import { useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";

// Replaces window.confirm() with a two-step, in-system confirmation for the
// app's highest-trust actions (sharing a calendar, removing a friend). The
// confirming state lives inline in this component's own markup rather than a
// portal/dialog, so it stays inside the surrounding <form action={...}> for
// free — no extra client/server plumbing — while still reading as Overlap
// (warm surface, pill buttons) instead of dropping into unstyled OS chrome.
export function ConfirmSubmitButton({
  confirmMessage,
  confirmLabel = "Confirm",
  pendingText,
  variant = "accent",
  children,
  className,
  "aria-label": ariaLabel,
}: {
  confirmMessage: string;
  confirmLabel?: string;
  pendingText: string;
  variant?: "accent" | "danger";
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus moves to Cancel, not Confirm, when the row appears — Escape/Enter
  // from here defaults to backing out of a destructive/consequential action.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <button
        type="button"
        className={className}
        aria-label={ariaLabel}
        onClick={() => setConfirming(true)}
      >
        {children}
      </button>
    );
  }

  const confirmToneClass =
    variant === "danger"
      ? "bg-danger-muted text-danger hover:opacity-80"
      : "bg-accent text-accent-foreground hover:opacity-90";

  return (
    <div
      role="group"
      aria-label={confirmMessage}
      className="flex flex-col items-end gap-2.5 rounded-2xl border border-border bg-surface-muted p-3 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:gap-3"
      onKeyDown={(e) => {
        if (e.key === "Escape") setConfirming(false);
      }}
    >
      <p className="text-xs leading-relaxed text-muted sm:max-w-[200px]">{confirmMessage}</p>
      <div className="flex shrink-0 gap-2">
        <button
          ref={cancelRef}
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-full bg-surface px-3.5 py-2 text-sm font-medium text-muted transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] hover:text-foreground"
        >
          Cancel
        </button>
        <SubmitButton
          pendingText={pendingText}
          className={`rounded-full px-3.5 py-2 text-sm font-medium transition duration-200 ease-[var(--ease-premium)] active:scale-[0.98] disabled:opacity-50 ${confirmToneClass}`}
        >
          {confirmLabel}
        </SubmitButton>
      </div>
    </div>
  );
}
