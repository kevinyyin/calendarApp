"use client";

import { useEffect, useRef } from "react";

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
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error(error);
    // Moves focus onto the boundary on mount so a screen-reader user isn't
    // left unaware the document was just replaced. No custom outline style
    // here — this file deliberately has no CSS dependency, so it relies on
    // the browser's own default focus ring rather than reimplementing one.
    headingRef.current?.focus();
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
        <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: "1.125rem", fontWeight: 600 }}>
          Something went wrong
        </h1>
        <p style={{ maxWidth: "20rem", fontSize: "0.875rem", color: "#6b7280" }}>
          This page hit an unexpected error. Trying again usually fixes it.
        </p>
        <div style={{ display: "flex", gap: "0.75rem" }}>
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
          {/* A plain <a>, not next/link: this boundary exists specifically
              for when the root layout's own data fetching (its auth()+DB
              call) is broken. A client-side transition could just re-hit
              that same broken render; a full page load is the more likely
              path to actually recover. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              borderRadius: "0.375rem",
              border: "1px solid #d1d5db",
              color: "#374151",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
