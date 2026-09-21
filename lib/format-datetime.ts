// Same-day events render "Sep 21, 9:00 AM – 9:30 AM PDT"; a range crossing
// midnight in the display timezone renders "Sep 21, 9:00 PM – Sep 22, 1:00
// AM PDT" so the second date is never silently dropped. `timeZone` is an
// IANA zone name for tests only — production call sites omit it, so Intl
// uses the browser's own local zone, matching what the previous
// toLocaleString()/toLocaleTimeString() calls did, just formatted
// consistently and with an explicit zone abbreviation instead of none.
export function formatEventRange(start: Date, end: Date, timeZone?: string): string {
  const zoneOpt = timeZone ? { timeZone } : {};
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...zoneOpt,
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...zoneOpt,
  });
  const timeWithZoneFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    ...zoneOpt,
  });

  const startDate = dateFmt.format(start);
  const endDate = dateFmt.format(end);
  const startTime = timeFmt.format(start);
  const endTimeWithZone = timeWithZoneFmt.format(end);

  if (startDate === endDate) {
    return `${startDate}, ${startTime} – ${endTimeWithZone}`;
  }
  return `${startDate}, ${startTime} – ${endDate}, ${endTimeWithZone}`;
}
