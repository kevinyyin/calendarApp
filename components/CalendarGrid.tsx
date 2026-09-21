import { formatEventRange } from "@/lib/format-datetime";
import { Badge } from "@/components/Badge";

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

const hourLabelFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric" });

function dayKey(d: Date): string {
  return d.toDateString();
}

// Fractional hour-of-day in the viewer's local time (9:30am -> 9.5), so the
// timeline bar can place an event with simple percentage math. Events here
// are already grouped into local calendar days (see dayKey), so this needs
// none of the cross-timezone arithmetic lib/free-slots.ts does for range
// search across days.
function hourOfDay(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

const DEFAULT_BAND_START_HOUR = 7;
const DEFAULT_BAND_END_HOUR = 23;
const MIN_SEGMENT_WIDTH_PCT = 1.5;
const LANE_HEIGHT_PX = 14;
const LANE_GAP_PX = 4;

// An event ending at/after midnight relative to its own start is clamped to
// this day's band end (24) rather than wrapping to a near-zero hour — the
// bar is a visual aid only, the list below it always carries the exact
// range, so clamping here never hides real data, only its on-screen extent.
function endHourForDay(event: MergedEvent): number {
  if (event.endAt.toDateString() !== event.startAt.toDateString()) return 24;
  const h = hourOfDay(event.endAt);
  return h === 0 ? 24 : h;
}

/**
 * The band a day's timeline bar spans, in whole hours. Defaults to a typical
 * waking-hours window (7am-11pm) for visual consistency across days, but
 * always widens to fit real events rather than clipping them — an event at
 * 6am or past 11pm still has to be visible, not just implied by the list.
 */
function dayBand(events: MergedEvent[]): { start: number; end: number } {
  let start = DEFAULT_BAND_START_HOUR;
  let end = DEFAULT_BAND_END_HOUR;
  for (const event of events) {
    start = Math.min(start, Math.floor(hourOfDay(event.startAt)));
    end = Math.max(end, Math.ceil(endHourForDay(event)));
  }
  return { start, end };
}

// Greedy interval-scheduling lane assignment: two events that overlap in
// time never share a lane, so simultaneous events from different people (or
// double-booked ones from the same person) stack as parallel bars instead of
// silently overlapping into one indistinguishable block.
function assignLanes(events: MergedEvent[]): { laneOf: number[]; laneCount: number } {
  const laneEnds: number[] = [];
  const laneOf: number[] = [];
  for (const event of events) {
    const startMs = event.startAt.getTime();
    let lane = laneEnds.findIndex((endMs) => endMs <= startMs);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(event.endAt.getTime());
    } else {
      laneEnds[lane] = event.endAt.getTime();
    }
    laneOf.push(lane);
  }
  return { laneOf, laneCount: laneEnds.length || 1 };
}

// Purely decorative (aria-hidden): the <ul> below it is the accessible,
// exact-time record of the same day, so screen reader and keyboard users
// lose nothing by this bar existing only for sighted at-a-glance scanning.
function DayTimeline({
  events,
  band,
}: {
  events: MergedEvent[];
  band: { start: number; end: number };
}) {
  const { laneOf, laneCount } = assignLanes(events);
  const span = band.end - band.start;

  return (
    // `bg-surface` (white/near-black card), not `bg-surface-muted`: that pale
    // blue token sits too close to several of Google Calendar's own light
    // event colors (e.g. Lavender #a4bdfc) for a segment to read clearly
    // against it, and it also failed contrast for the hour labels below
    // (`text-muted` only clears ~3.67:1 on `bg-surface-muted` vs ~5.2:1 here).
    <div aria-hidden="true" className="mb-3 rounded-xl border border-border bg-surface p-2.5">
      <div
        className="relative"
        style={{ height: laneCount * LANE_HEIGHT_PX + (laneCount - 1) * LANE_GAP_PX }}
      >
        {events.map((event, i) => {
          const startFrac = Math.max(band.start, hourOfDay(event.startAt));
          const endFrac = Math.min(band.end, endHourForDay(event));
          const leftPct = ((startFrac - band.start) / span) * 100;
          const widthPct = Math.max(
            MIN_SEGMENT_WIDTH_PCT,
            ((Math.max(endFrac, startFrac + 0.05) - startFrac) / span) * 100,
          );
          return (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                top: laneOf[i] * (LANE_HEIGHT_PX + LANE_GAP_PX),
                height: LANE_HEIGHT_PX,
                backgroundColor: event.color,
              }}
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
          <DayTimeline events={day.events} band={dayBand(day.events)} />
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {day.events.map((event, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3.5 first:pt-2.5 last:pb-2.5"
              >
                <span className="tabular-nums whitespace-nowrap text-sm text-muted">
                  {formatEventRange(event.startAt, event.endAt)}
                </span>
                <span className="font-medium text-foreground">{event.title}</span>
                <Badge dotColor={event.color}>{event.personLabel}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
