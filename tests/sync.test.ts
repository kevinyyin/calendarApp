import { describe, it, expect, vi, beforeEach } from "vitest";

const listMock = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    calendar: () => ({ events: { list: listMock } }),
    auth: { OAuth2: vi.fn() },
  },
}));

import { fetchAllGoogleEvents } from "@/lib/google-calendar-events";

describe("fetchAllGoogleEvents", () => {
  beforeEach(() => listMock.mockReset());

  it("paginates through all pages and returns the final sync token", async () => {
    listMock
      .mockResolvedValueOnce({
        data: {
          items: [{ id: "e1", summary: "Standup", status: "confirmed" }],
          nextPageToken: "page2",
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ id: "e2", summary: "Lunch", status: "confirmed" }],
          nextSyncToken: "sync-token-final",
        },
      });

    const result = await fetchAllGoogleEvents("token", "cal-id");

    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe("e1");
    expect(result.items[1].id).toBe("e2");
    expect(result.nextSyncToken).toBe("sync-token-final");
    expect(listMock).toHaveBeenCalledTimes(2);
  });
});

type EventRow = {
  googleCalendarRowId: string;
  googleEventId: string;
  [key: string]: unknown;
};

const dbState: { events: EventRow[] } = { events: [] };

vi.mock("@/db/client", () => ({
  db: {
    delete: vi.fn(() => ({ where: vi.fn(async () => { dbState.events = []; }) })),
    insert: vi.fn(() => ({
      values: vi.fn((row: EventRow) => {
        return {
          onConflictDoUpdate: vi.fn(async ({ set }: { set: Partial<EventRow> }) => {
            const existingIndex = dbState.events.findIndex(
              (e) =>
                e.googleCalendarRowId === row.googleCalendarRowId &&
                e.googleEventId === row.googleEventId,
            );
            if (existingIndex >= 0) {
              dbState.events[existingIndex] = { ...dbState.events[existingIndex], ...set };
            } else {
              dbState.events.push(row);
            }
          }),
        };
      }),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => {}) })) })),
  },
}));

import { upsertEventsFromGoogle } from "@/lib/sync";
import type { GoogleEvent } from "@/lib/google-calendar-events";

describe("upsertEventsFromGoogle", () => {
  it("maps Google event shape to our events rows", async () => {
    dbState.events = [];
    await upsertEventsFromGoogle("calendar-row-1", [
      {
        id: "e1",
        summary: "Standup",
        description: "daily sync",
        location: "Zoom",
        status: "confirmed",
        start: { dateTime: "2026-09-18T09:00:00-07:00" },
        end: { dateTime: "2026-09-18T09:15:00-07:00" },
      },
    ] as GoogleEvent[]);

    expect(dbState.events).toHaveLength(1);
    expect(dbState.events[0]).toMatchObject({
      googleCalendarRowId: "calendar-row-1",
      googleEventId: "e1",
      title: "Standup",
      description: "daily sync",
      location: "Zoom",
      isAllDay: false,
      status: "confirmed",
    });
  });

  it("marks all-day events correctly", async () => {
    dbState.events = [];
    await upsertEventsFromGoogle("calendar-row-1", [
      {
        id: "e2",
        summary: "Vacation",
        status: "confirmed",
        start: { date: "2026-09-20" },
        end: { date: "2026-09-22" },
      },
    ] as GoogleEvent[]);

    expect(dbState.events[0].isAllDay).toBe(true);
  });
});
