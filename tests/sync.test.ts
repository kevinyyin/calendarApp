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

// Drizzle's `eq`/`and` build real SQL condition objects (not mocked here), so
// to make the mocked `delete().where(...)` actually respect the predicate
// (rather than always wiping every row) we walk the condition's queryChunks
// to recover the column/value pairs it was built from.
const COLUMN_TO_FIELD: Record<string, string> = {
  google_calendar_row_id: "googleCalendarRowId",
  google_event_id: "googleEventId",
};

function flattenQueryChunks(node: unknown, out: unknown[] = []): unknown[] {
  if (
    node &&
    typeof node === "object" &&
    Array.isArray((node as { queryChunks?: unknown[] }).queryChunks)
  ) {
    for (const chunk of (node as { queryChunks: unknown[] }).queryChunks) {
      flattenQueryChunks(chunk, out);
    }
  } else {
    out.push(node);
  }
  return out;
}

function extractWhereEquality(condition: unknown): Partial<EventRow> {
  const flat = flattenQueryChunks(condition);
  const pairs: Record<string, unknown> = {};
  for (let i = 0; i < flat.length; i++) {
    const item = flat[i];
    if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      "name" in item &&
      !("queryChunks" in item)
    ) {
      const valueNode = flat[i + 2];
      const value =
        valueNode && typeof valueNode === "object" && "value" in valueNode
          ? (valueNode as { value: unknown }).value
          : valueNode;
      const columnName = (item as { name: string }).name;
      pairs[COLUMN_TO_FIELD[columnName] ?? columnName] = value;
    }
  }
  return pairs as Partial<EventRow>;
}

vi.mock("@/db/client", () => ({
  db: {
    delete: vi.fn(() => ({
      where: vi.fn(async (condition: unknown) => {
        const pairs = extractWhereEquality(condition);
        // Only constrain on the columns that actually appear in the
        // predicate, so eq(googleEventId) alone matches (and would delete)
        // rows across every calendar row, same as it would in real SQL.
        dbState.events = dbState.events.filter((e) => {
          const matchesAllPredicateColumns = Object.entries(pairs).every(
            ([key, value]) => e[key as keyof EventRow] === value,
          );
          return !matchesAllPredicateColumns;
        });
      }),
    })),
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

  it("updates an existing row on conflict instead of inserting a duplicate", async () => {
    dbState.events = [];
    const baseEvent = {
      id: "e1",
      summary: "Standup",
      status: "confirmed",
      start: { dateTime: "2026-09-18T09:00:00-07:00" },
      end: { dateTime: "2026-09-18T09:15:00-07:00" },
    };

    // First call inserts the row.
    await upsertEventsFromGoogle("calendar-row-1", [baseEvent] as GoogleEvent[]);
    // Second call targets the SAME (googleCalendarRowId, googleEventId) pair
    // but with a changed field, exercising the onConflictDoUpdate branch.
    await upsertEventsFromGoogle("calendar-row-1", [
      { ...baseEvent, summary: "Standup (moved to 10am)" },
    ] as GoogleEvent[]);

    expect(dbState.events).toHaveLength(1);
    expect(dbState.events[0]).toMatchObject({
      googleCalendarRowId: "calendar-row-1",
      googleEventId: "e1",
      title: "Standup (moved to 10am)",
    });
  });

  it("scopes the cancelled-event delete to the matching calendar row, not just the event id", async () => {
    // Two different calendars whose events happen to share the same Google
    // event id — the exact cross-calendar collision the delete scoping fix
    // addresses (google_event_id is only unique per calendar).
    dbState.events = [
      {
        googleCalendarRowId: "calendar-row-1",
        googleEventId: "shared-id",
        title: "Calendar 1's event",
      },
      {
        googleCalendarRowId: "calendar-row-2",
        googleEventId: "shared-id",
        title: "Calendar 2's event",
      },
    ];

    await upsertEventsFromGoogle("calendar-row-1", [
      {
        id: "shared-id",
        summary: "Cancelled meeting",
        status: "cancelled",
      },
    ] as GoogleEvent[]);

    expect(dbState.events).toHaveLength(1);
    expect(dbState.events[0]).toMatchObject({
      googleCalendarRowId: "calendar-row-2",
      googleEventId: "shared-id",
    });
  });
});
