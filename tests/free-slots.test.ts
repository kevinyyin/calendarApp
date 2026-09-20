import { describe, it, expect } from "vitest";
import { findFreeSlots } from "@/lib/free-slots";

function d(iso: string) {
  return new Date(iso);
}

describe("findFreeSlots", () => {
  it("finds a single gap between two people's non-overlapping busy blocks", () => {
    const busy = [
      [{ start: d("2026-09-18T09:00:00Z"), end: d("2026-09-18T10:00:00Z") }],
      [{ start: d("2026-09-18T13:00:00Z"), end: d("2026-09-18T14:00:00Z") }],
    ];
    const slots = findFreeSlots(
      busy,
      { start: d("2026-09-18T08:00:00Z"), end: d("2026-09-18T16:00:00Z") },
      60,
    );
    expect(slots).toContainEqual({ start: d("2026-09-18T10:00:00Z"), end: d("2026-09-18T13:00:00Z") });
  });

  it("excludes slots shorter than the requested duration", () => {
    const busy = [
      [{ start: d("2026-09-18T09:00:00Z"), end: d("2026-09-18T09:45:00Z") }],
      [{ start: d("2026-09-18T10:15:00Z"), end: d("2026-09-18T11:00:00Z") }],
    ];
    // Only a 30-minute gap (09:45-10:15) exists; requesting 60 minutes should find nothing there.
    const slots = findFreeSlots(
      busy,
      { start: d("2026-09-18T09:00:00Z"), end: d("2026-09-18T11:00:00Z") },
      60,
    );
    expect(slots).toEqual([]);
  });

  it("merges back-to-back and overlapping busy blocks for the same person before computing gaps", () => {
    const busy = [
      [
        { start: d("2026-09-18T09:00:00Z"), end: d("2026-09-18T10:00:00Z") },
        { start: d("2026-09-18T10:00:00Z"), end: d("2026-09-18T11:00:00Z") }, // back-to-back
        { start: d("2026-09-18T10:30:00Z"), end: d("2026-09-18T11:30:00Z") }, // overlapping
      ],
    ];
    const slots = findFreeSlots(
      busy,
      { start: d("2026-09-18T09:00:00Z"), end: d("2026-09-18T13:00:00Z") },
      60,
    );
    expect(slots).toEqual([
      { start: d("2026-09-18T11:30:00Z"), end: d("2026-09-18T13:00:00Z") },
    ]);
  });

  it("treats an all-day event as busy for the full day within range", () => {
    const busy = [
      [{ start: d("2026-09-18T00:00:00Z"), end: d("2026-09-19T00:00:00Z") }],
    ];
    const slots = findFreeSlots(
      busy,
      { start: d("2026-09-18T00:00:00Z"), end: d("2026-09-19T00:00:00Z") },
      30,
    );
    expect(slots).toEqual([]);
  });

  it("returns an empty list when there are no people (nothing to be mutually free with)", () => {
    const slots = findFreeSlots(
      [],
      { start: d("2026-09-18T09:00:00Z"), end: d("2026-09-18T17:00:00Z") },
      30,
    );
    expect(slots).toEqual([]);
  });

  it("respects the waking-hours window, clipping gaps to it", () => {
    const busy: { start: Date; end: Date }[][] = [[]];
    // No offset argument: waking hours are interpreted in UTC, which is the
    // correct behaviour for a UTC viewer and the backwards-compatible
    // default for callers that don't know the viewer's timezone.
    const slots = findFreeSlots(
      busy,
      { start: d("2026-09-18T00:00:00Z"), end: d("2026-09-19T00:00:00Z") },
      60,
      { startHour: 8, endHour: 22 },
    );
    expect(slots).toEqual([
      { start: d("2026-09-18T08:00:00Z"), end: d("2026-09-18T22:00:00Z") },
    ]);
  });

  it("clips waking hours in the viewer's timezone, not in UTC", () => {
    const busy: { start: Date; end: Date }[][] = [[]];
    // 420 == what `new Date().getTimezoneOffset()` returns in US Pacific
    // daylight time (UTC-7): minutes to ADD to local time to reach UTC.
    // 8am-10pm local is therefore 15:00Z-05:00Z(+1), which straddles UTC
    // midnight — so over a single UTC day the viewer gets the tail of the
    // previous local evening and the start of the next local one.
    const slots = findFreeSlots(
      busy,
      { start: d("2026-09-18T00:00:00Z"), end: d("2026-09-19T00:00:00Z") },
      60,
      { startHour: 8, endHour: 22 },
      420,
    );

    expect(slots).toEqual([
      // 09-17 local evening, up to 22:00 local == 05:00Z
      { start: d("2026-09-18T00:00:00Z"), end: d("2026-09-18T05:00:00Z") },
      // 09-18 local morning from 08:00 local == 15:00Z, to the range end
      { start: d("2026-09-18T15:00:00Z"), end: d("2026-09-19T00:00:00Z") },
    ]);

    // The UTC-only behaviour (08:00Z-22:00Z) must NOT be what comes back —
    // that window is 01:00-15:00 in the viewer's actual day.
    expect(slots).not.toContainEqual({
      start: d("2026-09-18T08:00:00Z"),
      end: d("2026-09-18T22:00:00Z"),
    });
  });

  it("clips waking hours for a timezone ahead of UTC", () => {
    const busy: { start: Date; end: Date }[][] = [[]];
    // -540 == UTC+9 (Tokyo). 8am-10pm local is 23:00Z(-1) - 13:00Z.
    const slots = findFreeSlots(
      busy,
      { start: d("2026-09-18T00:00:00Z"), end: d("2026-09-19T00:00:00Z") },
      60,
      { startHour: 8, endHour: 22 },
      -540,
    );

    expect(slots).toEqual([
      { start: d("2026-09-18T00:00:00Z"), end: d("2026-09-18T13:00:00Z") },
      { start: d("2026-09-18T23:00:00Z"), end: d("2026-09-19T00:00:00Z") },
    ]);
  });

  it("still excludes busy time when clipping in a non-UTC timezone", () => {
    // A busy block inside the viewer's local waking window must still carve
    // the window up, not be lost by the offset arithmetic.
    const busy = [[{ start: d("2026-09-18T18:00:00Z"), end: d("2026-09-18T20:00:00Z") }]];
    const slots = findFreeSlots(
      busy,
      { start: d("2026-09-18T15:00:00Z"), end: d("2026-09-18T23:00:00Z") },
      60,
      { startHour: 8, endHour: 22 },
      420,
    );

    expect(slots).toEqual([
      { start: d("2026-09-18T15:00:00Z"), end: d("2026-09-18T18:00:00Z") },
      { start: d("2026-09-18T20:00:00Z"), end: d("2026-09-18T23:00:00Z") },
    ]);
  });
});
