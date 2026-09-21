import Link from "next/link";

const STEPS = [
  {
    number: "1",
    title: "Connect your calendar",
    body: "Sign in with Google and Overlap reads your events — nothing else.",
  },
  {
    number: "2",
    title: "Choose what to share",
    body: "Pick exactly which of your calendars accepted friends can see.",
  },
  {
    number: "3",
    title: "See everyone's week",
    body: "One merged view of your week and theirs — free slots, at a glance.",
  },
] as const;

// The offsets below turn a plain 3-up row into something closer to notes
// pinned at different times — friends coordinating plans is historically a
// corkboard/shared-calendar act, not a grid of feature cards. Same cards,
// same materials as the rest of the app (soft shadow, paper-white, teal
// accent) — only the arrangement is asymmetric, on sm+ only so mobile still
// stacks cleanly. No entrance animation here: the hero's rise-in is this
// page's one authored moment, and these cards sit below the fold on most
// viewports anyway, where a load-time animation would already be finished
// before anyone scrolls to see it.
const STEP_OFFSET = ["sm:translate-y-0", "sm:translate-y-6", "sm:-translate-y-3"] as const;

export function HomeLanding() {
  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden bg-background px-6 py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-32 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
      />

      <span className="absolute left-6 top-6 text-xs font-semibold uppercase tracking-[0.2em] text-accent sm:left-8 sm:top-8">
        Overlap
      </span>

      <div className="animate-rise-in relative flex w-full max-w-sm flex-col items-center gap-10 text-center">
        <div className="flex flex-col items-center gap-5">
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            See when everyone&apos;s actually free
          </h1>
          <p className="max-w-xs text-balance text-base leading-relaxed text-muted">
            Overlap merges your calendar with your friends&apos; — so planning
            together stops being a group-chat guessing game.
          </p>
        </div>

        <Link
          href="/login"
          className="w-full rounded-full bg-accent px-6 py-4 text-center text-sm font-medium text-accent-foreground shadow-[var(--shadow-soft)] transition duration-300 ease-[var(--ease-premium)] active:scale-[0.98] hover:opacity-90 hover:shadow-[var(--shadow-lifted)]"
        >
          Get started
        </Link>
      </div>

      <div className="relative mt-28 grid w-full max-w-3xl gap-5 sm:grid-cols-3 sm:gap-6">
        {STEPS.map((step, i) => (
          <div
            key={step.number}
            className={`rounded-2xl border border-border bg-surface p-6 text-left shadow-[var(--shadow-soft)] transition-shadow duration-300 ease-[var(--ease-premium)] hover:shadow-[var(--shadow-lifted)] ${STEP_OFFSET[i]}`}
          >
            <span className="text-sm font-semibold text-accent">{step.number}</span>
            <h2 className="mt-2 text-base font-semibold text-foreground">{step.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
