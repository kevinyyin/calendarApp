import { describe, it, expect, vi, beforeEach } from "vitest";

// `vi.hoisted` (rather than plain top-level `const`s) is required here: the
// mock factories below are hoisted above this file's other statements, and
// without it these variables would still be in their temporal dead zone
// when the factories run, throwing "Cannot access ... before initialization".
const { incrementalSyncMock, findChannelMock } = vi.hoisted(() => ({
  incrementalSyncMock: vi.fn().mockResolvedValue(undefined),
  findChannelMock: vi.fn(),
}));

vi.mock("@/lib/sync", () => ({ runIncrementalSync: incrementalSyncMock }));

vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => findChannelMock(),
      }),
    }),
  },
}));

import { POST } from "@/app/api/webhooks/google-calendar/route";

describe("POST /api/webhooks/google-calendar", () => {
  beforeEach(() => {
    incrementalSyncMock.mockClear();
    findChannelMock.mockReset();
  });

  it("triggers an incremental sync for a known channel", async () => {
    findChannelMock.mockResolvedValue([
      { googleCalendarRowId: "cal-row-1", channelId: "chan-1" },
    ]);

    const req = new Request("https://example.com/api/webhooks/google-calendar", {
      method: "POST",
      headers: {
        "x-goog-channel-id": "chan-1",
        "x-goog-resource-state": "exists",
      },
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(incrementalSyncMock).toHaveBeenCalledWith("cal-row-1");
  });

  it("returns 404 for an unknown channel without erroring", async () => {
    findChannelMock.mockResolvedValue([]);

    const req = new Request("https://example.com/api/webhooks/google-calendar", {
      method: "POST",
      headers: { "x-goog-channel-id": "unknown-chan" },
    });

    const res = await POST(req);

    expect(res.status).toBe(404);
    expect(incrementalSyncMock).not.toHaveBeenCalled();
  });
});
