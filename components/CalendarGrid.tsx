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
  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((event, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded border p-3"
          style={{ borderLeftColor: event.color, borderLeftWidth: 4 }}
        >
          <span className="text-sm text-slate-500">
            {event.startAt.toLocaleString()} – {event.endAt.toLocaleTimeString()}
          </span>
          <span className="font-medium">{event.title}</span>
          <span className="text-sm text-slate-400">({event.personLabel})</span>
        </li>
      ))}
    </ul>
  );
}
