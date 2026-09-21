import { formatEventRange } from "@/lib/format-datetime";

type MergedEvent = {
  personUserId: string;
  personLabel: string;
  color: string;
  title: string;
  startAt: Date;
  endAt: Date;
};

const dayHeadingFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

function dayKey(d: Date): string {
  return d.toDateString();
}

export function CalendarGrid({ events }: { events: MergedEvent[] }) {
  const sorted = [...events].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm font-medium text-foreground">Nothing on the calendar</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          No events this week from you or the friends you&apos;re currently
          showing.
        </p>
      </div>
    );
  }

  // Grouped by calendar day so a full week reads as a handful of short
  // lists rather than one flat wall of timestamps — the previous version's
  // rows repeated the full date on every single line.
  const days: { key: string; heading: string; events: MergedEvent[] }[] = [];
  for (const event of sorted) {
    const key = dayKey(event.startAt);
    const day = days.at(-1);
    if (day && day.key === key) {
      day.events.push(event);
    } else {
      days.push({ key, heading: dayHeadingFormatter.format(event.startAt), events: [event] });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {days.map((day) => (
        <div key={day.key}>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{day.heading}</h2>
          <ul className="flex flex-col gap-2">
            {day.events.map((event, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-soft)] transition-shadow duration-300 ease-[var(--ease-premium)] hover:shadow-[var(--shadow-lifted)]"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: event.color }}
                />
                <span className="tabular-nums whitespace-nowrap text-sm text-muted">
                  {formatEventRange(event.startAt, event.endAt)}
                </span>
                <span className="font-medium text-foreground">{event.title}</span>
                <span className="text-sm text-muted">({event.personLabel})</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
