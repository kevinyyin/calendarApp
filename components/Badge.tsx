const TONE_CLASSES = {
  neutral: "border-border bg-surface-muted text-muted",
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
