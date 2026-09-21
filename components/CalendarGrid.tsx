"use client";

import { useState } from "react";
import { formatEventRange } from "@/lib/format-datetime";
import { Badge } from "@/components/Badge";

type MergedEvent = {
  id: string;
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

const columnHeadingFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
});

const hourLabelFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric" });

function dayKey(d: Date): string {
  return d.toDateString();
}

// Fractional hour-of-day in the viewer's local time (9:30am -> 9.5), so the
// grid can place an event with simple px math (see HOUR_HEIGHT_PX below).
function hourOfDay(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

// Midnight-normalized so dayKey() comparisons are unaffected by the caller's
// time-of-day.
export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

const DEFAULT_BAND_START_HOUR = 7;
const DEFAULT_BAND_END_HOUR = 23;
const HOUR_HEIGHT_PX = 48;
const MIN_EVENT_HEIGHT_PX = 20;
// Matches the 7-day range app/page.tsx fetches (now -> now+7days) — day nav
// stays inside data we already have rather than triggering new fetches.
const WINDOW_DAYS = 7;

// An event ending at/after midnight relative to its own start is clamped to
// this day's band end (24) rather than wrapping to a near-zero hour.
function endHourForDay(event: MergedEvent): number {
  if (event.endAt.toDateString() !== event.startAt.toDateString()) return 24;
  const h = hourOfDay(event.endAt);
  return h === 0 ? 24 : h;
}

/**
 * The band the grid's hour axis spans, in whole hours. Defaults to a typical
 * waking-hours window (7am-11pm) for visual consistency, but always widens
 * to fit real events rather than clipping them.
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
// time never share a lane, so simultaneous events sit side-by-side on the
// grid instead of silently overlapping into one indistinguishable block.
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

function eventsOnDay(events: MergedEvent[], day: Date): MergedEvent[] {
  const key = dayKey(day);
  return events
    .filter((e) => dayKey(e.startAt) === key)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

// One event, absolutely positioned within its day column by time (top/
// height) and lane (left/width). The aria-label always carries the full
// title/time/person — the click-to-open popover is a sighted convenience on
// top of that, not the only place this information lives.
function EventBlock({
  event,
  band,
  lane,
  laneCount,
  isOpen,
  onToggle,
}: {
  event: MergedEvent;
  band: { start: number; end: number };
  lane: number;
  laneCount: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const startFrac = Math.max(band.start, hourOfDay(event.startAt));
  const endFrac = Math.min(band.end, endHourForDay(event));
  const top = (startFrac - band.start) * HOUR_HEIGHT_PX;
  const height = Math.max(MIN_EVENT_HEIGHT_PX, (endFrac - startFrac) * HOUR_HEIGHT_PX);
  const widthPct = 100 / laneCount;
  const leftPct = lane * widthPct;
  // The title always renders (truncated to one line) so a sighted user can
  // identify any event without clicking it open — only the secondary person
  // line is dropped when there isn't room for a second line of text.
  const showPerson = height >= 32;

  return (
    <div
      className="absolute px-0.5"
      style={{ top, height, left: `${leftPct}%`, width: `${widthPct}%` }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={`${event.title}, ${formatEventRange(event.startAt, event.endAt)}, ${event.personLabel}`}
        aria-expanded={isOpen}
        className="h-full w-full overflow-hidden rounded-md border border-l-4 border-border bg-surface px-1.5 py-0.5 text-left shadow-[var(--shadow-soft)] transition hover:bg-surface-muted"
        style={{ borderLeftColor: event.color }}
      >
        <span className="block truncate text-xs font-medium text-foreground">
          {event.title}
        </span>
        {showPerson && (
          <span className="block truncate text-xs text-muted">{event.personLabel}</span>
        )}
      </button>
      {isOpen && (
        <div
          role="dialog"
          onClick={(e) => e.stopPropagation()}
          className="absolute left-1/2 top-full z-10 mt-1 w-56 -translate-x-1/2 rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-lifted)]"
        >
          <p className="text-sm font-medium text-foreground">{event.title}</p>
          <p className="mt-1 text-xs tabular-nums text-muted">
            {formatEventRange(event.startAt, event.endAt)}
          </p>
          <Badge dotColor={event.color} className="mt-2">
            {event.personLabel}
          </Badge>
        </div>
      )}
    </div>
  );
}

// Renders one or more day columns sharing a single hour axis. `headings`
// turns on the per-column date labels used in week mode; day mode shows its
// single day's date in the heading above the grid instead.
function DayGrid({
  days,
  events,
  openKey,
  setOpenKey,
  headings,
}: {
  days: Date[];
  events: MergedEvent[];
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
  headings: boolean;
}) {
  const visibleEvents = days.flatMap((d) => eventsOnDay(events, d));
  const band = dayBand(visibleEvents);
  const span = band.end - band.start;
  const hourLines = Array.from({ length: span }, (_, i) => band.start + i + 1);
  const hourLabels = Array.from({ length: span }, (_, i) => band.start + i);

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      {headings && (
        <div className="mb-2 flex">
          <div className="w-12 shrink-0" />
          {days.map((d) => (
            <div
              key={dayKey(d)}
              className="flex-1 text-center text-xs font-semibold text-foreground"
            >
              {columnHeadingFormatter.format(d)}
            </div>
          ))}
        </div>
      )}
      <div className="flex">
        <div className="w-12 shrink-0 text-right">
          {hourLabels.map((h) => (
            <div
              key={h}
              style={{ height: HOUR_HEIGHT_PX }}
              className="pr-2 text-xs tabular-nums text-muted"
            >
              {hourLabelFormatter.format(new Date(2000, 0, 1, h))}
            </div>
          ))}
        </div>
        <div
          className="relative flex flex-1"
          style={{ height: span * HOUR_HEIGHT_PX }}
          onClick={() => setOpenKey(null)}
        >
          {hourLines.map((h) => (
            <div
              key={h}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 border-t border-border"
              style={{ top: (h - band.start) * HOUR_HEIGHT_PX }}
            />
          ))}
          {days.map((day) => {
            const dayEvents = eventsOnDay(events, day);
            const { laneOf, laneCount } = assignLanes(dayEvents);
            return (
              <div
                key={dayKey(day)}
                className="relative flex-1 border-l border-border first:border-l-0"
              >
                {dayEvents.map((event, i) => (
                  <EventBlock
                    key={event.id}
                    event={event}
                    band={band}
                    lane={laneOf[i]}
                    laneCount={laneCount}
                    isOpen={openKey === event.id}
                    onToggle={() => setOpenKey(openKey === event.id ? null : event.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CalendarGrid({ events }: { events: MergedEvent[] }) {
  const [mode, setMode] = useState<"day" | "week">("day");
  const [dayOffset, setDayOffset] = useState(0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Fixed once per mount rather than recomputed from `new Date()` on every
  // render — otherwise a long-mounted session (this view stays mounted
  // indefinitely for Realtime updates) that crosses midnight would silently
  // shift `weekDays` underneath an already-chosen `dayOffset`, and could
  // walk day navigation past the data actually fetched by app/page.tsx.
  const [today] = useState(() => addDays(new Date(), 0));

  if (events.length === 0) {
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

  const weekDays = Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(today, i));
  const selectedDay = weekDays[dayOffset];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-h-9 items-center gap-2">
          {mode === "day" && (
            <>
              <button
                type="button"
                onClick={() => setDayOffset((d) => Math.max(0, d - 1))}
                disabled={dayOffset === 0}
                aria-label="Previous day"
                className="rounded-full border border-border p-1.5 text-muted transition hover:bg-surface-muted disabled:opacity-30"
              >
                ‹
              </button>
              <h2 className="text-sm font-semibold text-foreground">
                {dayHeadingFormatter.format(selectedDay)}
              </h2>
              <button
                type="button"
                onClick={() => setDayOffset((d) => Math.min(WINDOW_DAYS - 1, d + 1))}
                disabled={dayOffset === WINDOW_DAYS - 1}
                aria-label="Next day"
                className="rounded-full border border-border p-1.5 text-muted transition hover:bg-surface-muted disabled:opacity-30"
              >
                ›
              </button>
            </>
          )}
        </div>
        <div className="flex overflow-hidden rounded-full border border-border text-sm">
          {(["day", "week"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setOpenKey(null);
              }}
              aria-pressed={mode === m}
              className={
                mode === m
                  ? "bg-accent px-3.5 py-1.5 font-medium text-accent-foreground"
                  : "px-3.5 py-1.5 text-muted transition hover:bg-surface-muted"
              }
            >
              {m === "day" ? "Day" : "Week"}
            </button>
          ))}
        </div>
      </div>

      <DayGrid
        days={mode === "day" ? [selectedDay] : weekDays}
        events={events}
        openKey={openKey}
        setOpenKey={setOpenKey}
        headings={mode === "week"}
      />
    </div>
  );
}
