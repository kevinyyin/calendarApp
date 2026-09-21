"use client";

import { SubmitButton } from "@/components/SubmitButton";

// A SubmitButton that asks window.confirm(confirmMessage) before letting the
// submit through. `confirmMessage` is a plain string, not a function, so
// nothing crosses the server/client boundary that can't be serialized — a
// Server Component page can render this and pass a string, without hitting
// the "functions cannot be passed to Client Components" trap that a
// server-defined onClick closure would.
export function ConfirmSubmitButton({
  confirmMessage,
  pendingText,
  children,
  className,
}: {
  confirmMessage: string;
  pendingText: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SubmitButton
      pendingText={pendingText}
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
    </SubmitButton>
  );
}
