export type Interval = { start: Date; end: Date };

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [sorted[0]];

  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (current.start.getTime() <= last.end.getTime()) {
      if (current.end.getTime() > last.end.getTime()) {
        last.end = current.end;
      }
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * Splits `range` into one window per day, clipped to the waking-hours band.
 *
 * `timezoneOffsetMinutes` is exactly what `Date.prototype.getTimezoneOffset()`
 * returns in the viewer's browser: the minutes to ADD to local time to get
 * UTC (positive west of Greenwich — 420 for UTC-7, -540 for UTC+9). The
 * day/hour arithmetic below is done on a UTC instant shifted into the
 * viewer's local frame and shifted back afterwards, which keeps the existing
 * `setUTCHours` logic intact while making "8am" mean 8am where the viewer
 * actually is. `0` (the default) reproduces the previous UTC-only behaviour.
 *
 * A numeric offset rather than an IANA zone name is deliberate: it needs no
 * new dependency, and the only thing being decided here is which wall-clock
 * hours count as waking. It does mean a range crossing a DST transition uses
 * the offset that was in effect when the viewer's browser reported it, which
 * can shift that band by an hour on the far side of the transition.
 */
function clipToWakingHours(
  range: Interval,
  wakingHours: { startHour: number; endHour: number },
  timezoneOffsetMinutes: number,
): Interval[] {
  const offsetMs = timezoneOffsetMinutes * 60 * 1000;
  const days: Interval[] = [];

  // Local wall-clock time, represented as a Date whose UTC fields read as
  // the viewer's local fields — so `setUTCHours` below sets LOCAL hours.
  const cursor = new Date(range.start.getTime() - offsetMs);
  cursor.setUTCHours(0, 0, 0, 0);
  const localRangeEnd = range.end.getTime() - offsetMs;

  while (cursor.getTime() < localRangeEnd) {
    const dayStart = new Date(cursor);
    dayStart.setUTCHours(wakingHours.startHour, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setUTCHours(wakingHours.endHour, 0, 0, 0);

    // Back to real UTC instants before clipping against the requested range.
    const clippedStart = new Date(
      Math.max(dayStart.getTime() + offsetMs, range.start.getTime()),
    );
    const clippedEnd = new Date(
      Math.min(dayEnd.getTime() + offsetMs, range.end.getTime()),
    );
    if (clippedStart.getTime() < clippedEnd.getTime()) {
      days.push({ start: clippedStart, end: clippedEnd });
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

export function findFreeSlots(
  busyIntervalsByPerson: Interval[][],
  range: Interval,
  durationMinutes: number,
  wakingHours: { startHour: number; endHour: number } = { startHour: 0, endHour: 24 },
  // See clipToWakingHours: the viewer's `Date#getTimezoneOffset()` value.
  // Defaults to 0 (UTC) so existing callers behave exactly as before.
  timezoneOffsetMinutes: number = 0,
): Interval[] {
  if (busyIntervalsByPerson.length === 0) return [];

  const allBusy = mergeIntervals(busyIntervalsByPerson.flat());
  const durationMs = durationMinutes * 60 * 1000;
  const windows = clipToWakingHours(range, wakingHours, timezoneOffsetMinutes);

  const freeSlots: Interval[] = [];

  for (const window of windows) {
    let cursor = window.start;
    for (const busy of allBusy) {
      if (busy.end.getTime() <= cursor.getTime() || busy.start.getTime() >= window.end.getTime()) {
        continue;
      }
      if (busy.start.getTime() > cursor.getTime()) {
        const gapEnd = new Date(Math.min(busy.start.getTime(), window.end.getTime()));
        if (gapEnd.getTime() - cursor.getTime() >= durationMs) {
          freeSlots.push({ start: new Date(cursor), end: gapEnd });
        }
      }
      if (busy.end.getTime() > cursor.getTime()) {
        cursor = new Date(busy.end);
      }
    }
    if (cursor.getTime() < window.end.getTime() && window.end.getTime() - cursor.getTime() >= durationMs) {
      freeSlots.push({ start: new Date(cursor), end: new Date(window.end) });
    }
  }

  return freeSlots;
}
