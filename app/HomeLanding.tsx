import Link from "next/link";
import { Badge } from "@/components/Badge";

const FACTS = [
  {
    tag: "Google Calendar",
    body: "Overlap reads your events straight from Google — nothing else, nothing stored beyond a synced copy of what you share.",
  },
  {
    tag: "Friends only",
    body: "No public directory. A calendar becomes visible only after both people accept a friend request.",
  },
  {
    tag: "Free-time finder",
    body: "Pick a group, pick a duration, and Overlap searches the next two weeks for the first slot that works for everyone.",
  },
] as const;

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

export function HomeLanding() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 h-[36rem] w-[36rem] translate-x-1/3 -translate-y-1/3 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
      />

      <div className="animate-rise-in relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10 sm:px-10 sm:py-14">
        <div className="mb-20 flex items-center justify-between sm:mb-28">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Overlap
          </span>
          <Link
            href="/login"
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-surface-muted"
          >
            Sign in
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-12">
          <div className="flex min-w-0 flex-col gap-8 lg:col-span-7">
            <h1 className="text-balance text-display font-semibold text-foreground">
              See when everyone&apos;s actually free
            </h1>
            <p className="max-w-md text-balance text-lg leading-relaxed text-muted">
              Overlap merges your calendar with your friends&apos; — so planning
              together stops being a group-chat guessing game.
            </p>
            <Link
              href="/login"
              className="w-fit rounded-full bg-accent px-6 py-3.5 text-sm font-medium text-accent-foreground shadow-[var(--shadow-soft)] transition duration-300 ease-[var(--ease-premium)] active:scale-[0.98] hover:opacity-90 hover:shadow-[var(--shadow-lifted)]"
            >
              Get started
            </Link>
          </div>

          <div className="flex min-w-0 flex-col divide-y divide-border border-t border-border lg:col-span-5 lg:border-t-0 lg:pl-12">
            {FACTS.map((fact) => (
              <div key={fact.tag} className="flex flex-col gap-2 py-5 first:pt-0 lg:first:pt-1">
                <Badge tone="outline">{fact.tag}</Badge>
                <p className="text-sm leading-relaxed text-muted">{fact.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 divide-y divide-border border-y border-border sm:mt-32 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {STEPS.map((step) => (
            <div key={step.number} className="flex flex-col gap-2 py-8 sm:px-8 sm:py-10 first:sm:pl-0">
              <span className="text-sm font-semibold tabular-nums text-accent">{step.number}</span>
              <h2 className="text-base font-semibold text-foreground">{step.title}</h2>
              <p className="text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
