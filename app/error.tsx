"use client";

import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
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
