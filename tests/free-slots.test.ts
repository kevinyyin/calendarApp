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
});
