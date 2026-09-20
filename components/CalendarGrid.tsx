type MergedEvent = {
  personUserId: string;
  personLabel: string;
  color: string;
  title: string;
  startAt: Date;
  endAt: Date;
};

export function CalendarGrid({ events }: { events: MergedEvent[] }) {
  const sorted = [...events].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium text-foreground">Nothing on the calendar</p>
        <p className="mt-1 text-sm text-muted">
          No events this week from you or the friends you&apos;re currently
          showing.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((event, i) => (
        <li
          key={i}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface p-3"
        >
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: event.color }}
          />
          <span className="whitespace-nowrap text-sm text-muted">
            {event.startAt.toLocaleString()} – {event.endAt.toLocaleTimeString()}
          </span>
          <span className="font-medium text-foreground">{event.title}</span>
          <span className="text-sm text-muted">({event.personLabel})</span>
        </li>
      ))}
    </ul>
  );
}
