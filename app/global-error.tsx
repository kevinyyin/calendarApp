"use client";

import { useEffect } from "react";

// Catches errors thrown by app/layout.tsx itself (it does its own auth() +
// DB lookup on every request) — app/error.tsx can't see those, since a
// segment's error boundary wraps everything BELOW it, not the layout it
// shares a segment with. This replaces the entire document, so per Next's
// docs it doesn't receive globals.css/Tailwind automatically — inline
// styles only, deliberately, so this last-resort fallback doesn't depend on
// anything that could itself be broken.
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ maxWidth: "20rem", fontSize: "0.875rem", color: "#6b7280" }}>
          This page hit an unexpected error. Trying again usually fixes it.
        </p>
        <button
          onClick={() => retry()}
          style={{
            borderRadius: "0.375rem",
            backgroundColor: "#4f46e5",
            color: "#ffffff",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
