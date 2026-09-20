import { describe, it, expect } from "vitest";
import {
  mergeIncomingEvent,
  applyRealtimeEvent,
  removeEventById,
} from "@/components/RealtimeMergedView";

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

const existingRow = {
  id: "e1",
  personUserId: "friend-1",
  personLabel: "Alice",
  color: "#111",
  title: "Standup",
  startAt: new Date("2026-09-18T09:00:00Z"),
  endAt: new Date("2026-09-18T09:30:00Z"),
};

describe("removeEventById", () => {
  it("drops the matching row and leaves the rest alone", () => {
    const other = { ...existingRow, id: "e2", title: "Lunch" };
    expect(removeEventById([existingRow, other], "e1")).toEqual([other]);
  });

  it("is a no-op when nothing matches", () => {
    expect(removeEventById([existingRow], "nope")).toEqual([existingRow]);
  });
});

describe("applyRealtimeEvent", () => {
  it("removes the row on a DELETE, using only payload.old.id", () => {
    // A cancelled Google Calendar event is implemented as a DELETE of the
    // `events` row (lib/sync.ts's upsertEventsFromGoogle), and the table's
    // REPLICA IDENTITY is PK-only, so `payload.old` reliably carries nothing
    // but `id` — no title, no google_calendar_row_id. The DELETE branch must
    // therefore not depend on the calendar-metadata map at all.
    const result = applyRealtimeEvent([existingRow], calendarMeta, {
      eventType: "DELETE",
      new: {},
      old: { id: "e1" },
    });

    expect(result).toEqual([]);
  });

  it("does not mistake a DELETE for an upsert just because payload.new is a non-null empty object", () => {
    // The original bug: `payload.new ?? payload.old`. Supabase Realtime sends
    // `new: {}` (truthy) on DELETE rather than null/undefined, so `??` never
    // fell through to `old` — the row was "merged" with an undefined id and
    // the deleted event stayed on screen forever.
    const result = applyRealtimeEvent([existingRow], calendarMeta, {
      eventType: "DELETE",
      new: {},
      old: { id: "e1" },
    });

    expect(result.some((e) => e.id === "e1")).toBe(false);
    expect(result.some((e) => e.id === undefined)).toBe(false);
  });

  it("merges the new row on an INSERT", () => {
    const result = applyRealtimeEvent([], calendarMeta, {
      eventType: "INSERT",
      new: {
        id: "e9",
        title: "New meeting",
        start_at: "2026-09-18T11:00:00Z",
        end_at: "2026-09-18T12:00:00Z",
        google_calendar_row_id: "cal-1",
      },
      old: {},
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "e9", title: "New meeting", personLabel: "Alice" });
  });

  it("replaces the row on an UPDATE", () => {
    const result = applyRealtimeEvent([existingRow], calendarMeta, {
      eventType: "UPDATE",
      new: {
        id: "e1",
        title: "Standup (moved)",
        start_at: "2026-09-18T09:30:00Z",
        end_at: "2026-09-18T10:00:00Z",
        google_calendar_row_id: "cal-1",
      },
      old: { id: "e1" },
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Standup (moved)");
  });

  it("leaves state untouched when a DELETE payload has no usable old id", () => {
    const result = applyRealtimeEvent([existingRow], calendarMeta, {
      eventType: "DELETE",
      new: {},
      old: {},
    });

    expect(result).toEqual([existingRow]);
  });
});
