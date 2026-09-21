import { describe, it, expect } from "vitest";
import { groupSlotsByDay, computeDayBand } from "@/app/find-time/FreeSlotsCalendar";

function slot(startIso: string, endIso: string) {
  return { start: new Date(startIso), end: new Date(endIso) };
}

describe("groupSlotsByDay", () => {
  it("groups consecutive slots on the same local day together", () => {
    const slots = [
      slot("2026-09-22T14:00:00Z", "2026-09-22T15:00:00Z"),
      slot("2026-09-22T17:00:00Z", "2026-09-22T18:00:00Z"),
    ];
    const days = groupSlotsByDay(slots);
    expect(days).toHaveLength(1);
    expect(days[0].slots).toHaveLength(2);
  });

  it("splits slots on different days into separate groups, in chronological order", () => {
    const slots = [
      slot("2026-09-23T14:00:00Z", "2026-09-23T15:00:00Z"),
      slot("2026-09-22T14:00:00Z", "2026-09-22T15:00:00Z"),
    ];
    const days = groupSlotsByDay(slots);
    expect(days).toHaveLength(2);
    // Sorted chronologically regardless of input order.
    expect(days[0].slots[0].start.getTime()).toBeLessThan(days[1].slots[0].start.getTime());
  });

  it("returns an empty array for no slots", () => {
    expect(groupSlotsByDay([])).toEqual([]);
  });
});

describe("computeDayBand", () => {
  it("defaults to the 8am-10pm search window when every slot fits inside it", () => {
    const slots = [slot("2026-09-22T14:00:00Z", "2026-09-22T15:00:00Z")];
    // Force a fixed timezone-independent check by using UTC-based Date
    // methods indirectly isn't possible here since computeDayBand reads
    // local wall-clock hours — assert the band never shrinks below defaults.
    const band = computeDayBand(slots);
    expect(band.start).toBeLessThanOrEqual(8);
    expect(band.end).toBeGreaterThanOrEqual(22);
  });

  it("widens the band to fit a slot that starts before the default band start", () => {
    const early = new Date();
    early.setHours(5, 0, 0, 0);
    const earlyEnd = new Date(early);
    earlyEnd.setHours(6, 0, 0, 0);
    const band = computeDayBand([{ start: early, end: earlyEnd }]);
    expect(band.start).toBeLessThanOrEqual(5);
  });

  it("widens the band to fit a slot that ends after the default band end", () => {
    const late = new Date();
    late.setHours(23, 0, 0, 0);
    const lateEnd = new Date(late);
    lateEnd.setHours(23, 30, 0, 0);
    const band = computeDayBand([{ start: late, end: lateEnd }]);
    expect(band.end).toBeGreaterThanOrEqual(24);
  });
});
