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

function clipToWakingHours(
  range: Interval,
  wakingHours: { startHour: number; endHour: number },
): Interval[] {
  const days: Interval[] = [];
  const cursor = new Date(range.start);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() < range.end.getTime()) {
    const dayStart = new Date(cursor);
    dayStart.setUTCHours(wakingHours.startHour, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setUTCHours(wakingHours.endHour, 0, 0, 0);

    const clippedStart = new Date(Math.max(dayStart.getTime(), range.start.getTime()));
    const clippedEnd = new Date(Math.min(dayEnd.getTime(), range.end.getTime()));
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
): Interval[] {
  if (busyIntervalsByPerson.length === 0) return [];

  const allBusy = mergeIntervals(busyIntervalsByPerson.flat());
  const durationMs = durationMinutes * 60 * 1000;
  const windows = clipToWakingHours(range, wakingHours);

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
