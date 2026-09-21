"use client";

import { useEffect, useRef } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error(error);
    // Moves both visual and screen-reader focus onto the boundary the
    // instant it mounts — without this, a screen-reader user gets no
    // indication the page's content just changed underneath them; they'd
    // have to manually re-explore the page to discover the error.
    headingRef.current?.focus();
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <h1 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-foreground">
        Something went wrong
      </h1>
      <p className="max-w-xs text-sm text-muted">
        This page hit an unexpected error. Trying again usually fixes it.
      </p>
      <button
        onClick={() => retry()}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition active:scale-95 hover:opacity-90"
      >
        Try again
      </button>
    </main>
  );
}
