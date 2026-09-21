import { formatEventRange } from "@/lib/format-datetime";

export type FreeSlot = { start: Date; end: Date };

const dayHeadingFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const hourLabelFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric" });

// Matches the "8:00 AM – 10:00 PM" search window described in FindTimeForm.
const DEFAULT_BAND_START_HOUR = 8;
const DEFAULT_BAND_END_HOUR = 22;
const MIN_SEGMENT_WIDTH_PCT = 1.5;

function dayKey(d: Date): string {
  return d.toDateString();
}

// Fractional hour-of-day in the viewer's local time, mirroring
// components/CalendarGrid.tsx's DayTimeline so both timeline bars behave
// identically.
function hourOfDay(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

function endHourForDay(slot: FreeSlot): number {
  if (slot.end.toDateString() !== slot.start.toDateString()) return 24;
  const h = hourOfDay(slot.end);
  return h === 0 ? 24 : h;
}

/**
 * The band a day's timeline bar spans, in whole hours. Defaults to the
 * search window (8am-10pm) but widens to fit a slot outside it rather than
 * clipping it — findFreeSlots doesn't currently produce these, but the list
 * below the bar is always the source of truth regardless.
 */
export function computeDayBand(slots: FreeSlot[]): { start: number; end: number } {
  let start = DEFAULT_BAND_START_HOUR;
  let end = DEFAULT_BAND_END_HOUR;
  for (const slot of slots) {
    start = Math.min(start, Math.floor(hourOfDay(slot.start)));
    end = Math.max(end, Math.ceil(endHourForDay(slot)));
  }
  return { start, end };
}

export function groupSlotsByDay(
  slots: FreeSlot[],
): { key: string; heading: string; slots: FreeSlot[] }[] {
  const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());
  const days: { key: string; heading: string; slots: FreeSlot[] }[] = [];
  for (const slot of sorted) {
    const key = dayKey(slot.start);
    const day = days.at(-1);
    if (day && day.key === key) {
      day.slots.push(slot);
    } else {
      days.push({ key, heading: dayHeadingFormatter.format(slot.start), slots: [slot] });
    }
  }
  return days;
}

// Purely decorative (aria-hidden): the <ul> below it is the accessible,
// exact-time record of the same day.
function DayTimeline({
  slots,
  band,
}: {
  slots: FreeSlot[];
  band: { start: number; end: number };
}) {
  const span = band.end - band.start;

  return (
    <div aria-hidden="true" className="mb-3 rounded-xl border border-border bg-surface p-2.5">
      <div className="relative h-3.5">
        {slots.map((slot, i) => {
          const startFrac = Math.max(band.start, hourOfDay(slot.start));
          const endFrac = Math.min(band.end, endHourForDay(slot));
          const leftPct = ((startFrac - band.start) / span) * 100;
          const widthPct = Math.max(
            MIN_SEGMENT_WIDTH_PCT,
            ((Math.max(endFrac, startFrac + 0.05) - startFrac) / span) * 100,
          );
          return (
            <span
              key={i}
              className="absolute top-0 h-3.5 rounded-full bg-success"
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-xs tabular-nums text-muted">
        <span>{hourLabelFormatter.format(new Date(2000, 0, 1, band.start))}</span>
        <span>{hourLabelFormatter.format(new Date(2000, 0, 1, Math.min(band.end, 23)))}</span>
      </div>
    </div>
  );
}

export function FreeSlotsCalendar({ slots }: { slots: FreeSlot[] }) {
  const days = groupSlotsByDay(slots);

  return (
    <div className="mt-10 flex flex-col gap-8">
      {days.map((day) => (
        <div key={day.key}>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{day.heading}</h2>
          <DayTimeline slots={day.slots} band={computeDayBand(day.slots)} />
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {day.slots.map((slot, i) => (
              <li
                key={i}
                className="tabular-nums py-3.5 text-sm text-foreground first:pt-2.5 last:pb-2.5"
              >
                {formatEventRange(slot.start, slot.end)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
