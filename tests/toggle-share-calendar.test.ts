import { describe, it, expect, vi, beforeEach } from "vitest";

// `vi.mock` factories are hoisted above this file's other statements, so
// referencing plain top-level `const`s from inside the factories throws
// "Cannot access ... before initialization" — `vi.hoisted` is required (see
// tests/renew-channels.test.ts and tests/reconnect-flag.test.ts for the same
// pattern).
const {
  authMock,
  runInitialSyncMock,
  registerWatchChannelMock,
  stopWatchChannelMock,
  insertValuesMock,
  updateSetMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  runInitialSyncMock: vi.fn(),
  registerWatchChannelMock: vi.fn(),
  stopWatchChannelMock: vi.fn(),
  insertValuesMock: vi.fn(async () => {}),
  updateSetMock: vi.fn(() => ({ where: vi.fn(async () => {}) })),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/sync", () => ({ runInitialSync: runInitialSyncMock }));
vi.mock("@/lib/google-watch", () => ({
  registerWatchChannel: registerWatchChannelMock,
  stopWatchChannel: stopWatchChannelMock,
}));
vi.mock("@/lib/google-calendar", () => ({ listGoogleCalendars: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const existingCalendarRow = {
  id: "cal-row-1",
  userId: "user-1",
  googleCalendarId: "google-cal-1",
  displayName: "Work",
  color: "#123456",
  isShared: false,
};

// The only DB reads `toggleShareCalendar` performs both resolve to the same
// existing google_calendars row here (an "already shared once before" case),
// which routes it through the `update` branch rather than `insert` for the
// calendar row itself — isolating `insertValuesMock` to only fire for the
// watchChannels insert, which is exactly what these tests need to observe.
vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [existingCalendarRow]),
      })),
    })),
    insert: vi.fn(() => ({ values: insertValuesMock })),
    update: vi.fn(() => ({ set: updateSetMock })),
    delete: vi.fn(() => ({ where: vi.fn(async () => {}) })),
  },
}));

import { toggleShareCalendar } from "@/app/calendars/actions";

function makeFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("googleCalendarId", "google-cal-1");
  fd.set("displayName", "Work");
  fd.set("color", "#123456");
  fd.set("enable", "true");
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value);
  return fd;
}

describe("toggleShareCalendar", () => {
  beforeEach(() => {
    authMock.mockReset();
    runInitialSyncMock.mockReset();
    registerWatchChannelMock.mockReset();
    insertValuesMock.mockClear();
    updateSetMock.mockClear();
    authMock.mockResolvedValue({
      user: { id: "user-1" },
      accessToken: "access-token-1",
    });
  });

  it("does not register a watch channel or insert a watchChannels row when the initial sync did not complete (401/403 bail-out)", async () => {
    // Simulates runInitialSync hitting an expired/revoked token: it marks
    // needsReconnect internally and returns false instead of throwing.
    runInitialSyncMock.mockResolvedValue(false);

    await toggleShareCalendar(makeFormData());

    expect(runInitialSyncMock).toHaveBeenCalledWith("cal-row-1", "access-token-1");
    expect(registerWatchChannelMock).not.toHaveBeenCalled();
    // insertValuesMock is only ever invoked (in this test's db mock) for the
    // watchChannels insert, since the googleCalendars row already exists and
    // goes through the `update` branch — so "never called" proves no
    // watchChannels row was written for a calendar that was never synced.
    expect(insertValuesMock).not.toHaveBeenCalled();
  });

  it("registers a watch channel and inserts a watchChannels row when the initial sync completes successfully", async () => {
    runInitialSyncMock.mockResolvedValue(true);
    registerWatchChannelMock.mockResolvedValue({
      channelId: "chan-1",
      resourceId: "res-1",
      expiresAt: new Date("2026-10-01T00:00:00Z"),
    });

    await toggleShareCalendar(makeFormData());

    expect(registerWatchChannelMock).toHaveBeenCalledWith(
      "access-token-1",
      "google-cal-1",
      expect.stringContaining("/api/webhooks/google-calendar"),
    );
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        googleCalendarRowId: "cal-row-1",
        channelId: "chan-1",
        resourceId: "res-1",
      }),
    );
  });
});
