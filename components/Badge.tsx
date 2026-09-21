const TONE_CLASSES = {
  // `text-muted` on `bg-surface-muted` only clears ~3.67:1 (both tokens are
  // pale blues) — below WCAG AA's 4.5:1 floor for normal text. `text-foreground`
  // on the same background clears ~6.6:1, matching the `accent` tone below,
  // which pairs an equally pale background with dark text for the same reason.
  neutral: "border-border bg-surface-muted text-foreground",
  outline: "border-border bg-transparent text-muted",
  accent: "border-transparent bg-accent-muted text-accent",
} as const;

/**
 * Small pill-shaped metadata tag — a count, a status, a person indicator.
 * Deliberately normal-case and never tracked/uppercase: that treatment is
 * reserved for the "Overlap" wordmark alone (see DESIGN.md's No-Kicker
 * Rule), so a badge can never be mistaken for a kicker.
 */
export function Badge({
  children,
  tone = "neutral",
  dotColor,
  className = "",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE_CLASSES;
  /** Renders a small color swatch before the label — e.g. a calendar's color. */
  dotColor?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-tag font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      {dotColor && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      )}
      {children}
    </span>
  );
}
