import { describe, it, expect } from "vitest";
import { mergeIncomingEvent } from "@/components/RealtimeMergedView";

const calendarMeta = {
  "cal-1": { personUserId: "friend-1", personLabel: "Alice", color: "#111" },
};

describe("mergeIncomingEvent", () => {
  it("adds a new event to the list when its calendar is known", () => {
    const result = mergeIncomingEvent([], calendarMeta, {
      id: "e1",
      title: "New meeting",
      startAt: "2026-09-18T09:00:00Z",
      endAt: "2026-09-18T09:30:00Z",
      googleCalendarRowId: "cal-1",
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      personUserId: "friend-1",
      personLabel: "Alice",
      color: "#111",
      title: "New meeting",
    });
  });

  it("replaces an existing event with the same id", () => {
    const existing = [
      {
        id: "e1",
        personUserId: "friend-1",
        personLabel: "Alice",
        color: "#111",
        title: "Old title",
        startAt: new Date("2026-09-18T09:00:00Z"),
        endAt: new Date("2026-09-18T09:30:00Z"),
      },
    ];
    const result = mergeIncomingEvent(existing, calendarMeta, {
      id: "e1",
      title: "Updated title",
      startAt: "2026-09-18T09:00:00Z",
      endAt: "2026-09-18T09:30:00Z",
      googleCalendarRowId: "cal-1",
    });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Updated title");
  });

  it("ignores an incoming event for a calendar not in the known-metadata map", () => {
    const result = mergeIncomingEvent([], calendarMeta, {
      id: "e2",
      title: "Unknown calendar's event",
      startAt: "2026-09-18T09:00:00Z",
      endAt: "2026-09-18T09:30:00Z",
      googleCalendarRowId: "cal-unrelated",
    });
    expect(result).toEqual([]);
  });
});
