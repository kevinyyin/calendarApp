import { describe, it, expect, vi, beforeEach } from "vitest";

const expiringChannel = {
  id: "wc-1",
  googleCalendarRowId: "cal-row-1",
  channelId: "old-chan",
  resourceId: "old-res",
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12), // 12h from now
};

// `vi.hoisted` (rather than plain top-level `const`s) is required here: the
// mock factories below are hoisted above this file's other statements, and
// without it these variables would still be in their temporal dead zone
// when the factories run, throwing "Cannot access ... before initialization"
// (see tests/webhook.test.ts for the same pattern).
const { selectMock, updateMock, insertMock, deleteMock, registerMock, freshTokenMock } =
  vi.hoisted(() => ({
    selectMock: vi.fn(),
    updateMock: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => {}) })) })),
    insertMock: vi.fn(() => ({ values: vi.fn(async () => {}) })),
    deleteMock: vi.fn(() => ({ where: vi.fn(async () => {}) })),
    registerMock: vi.fn().mockResolvedValue({
      channelId: "new-chan",
      resourceId: "new-res",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    }),
    // The route no longer reads (and decrypts) `accounts.access_token`
    // itself: Auth.js only ever writes that column on a user's FIRST
    // sign-in, so by the time this hourly cron runs the stored token is
    // almost always expired. It now asks `getFreshAccessToken` for a
    // guaranteed-valid token instead — see lib/google-token.ts.
    freshTokenMock: vi.fn(async () => "fresh-token"),
  }));

vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => selectMock(),
        }),
      }),
    }),
    update: updateMock,
    insert: insertMock,
    delete: deleteMock,
  },
}));

vi.mock("@/lib/google-watch", () => ({
  registerWatchChannel: registerMock,
  // Async, not a bare `vi.fn()`: the route chains `.catch(...)` onto this
  // call, so a mock returning `undefined` would throw a TypeError inside the
  // per-channel try/catch and silently make every renewal look failed.
  stopWatchChannel: vi.fn(async () => {}),
}));

vi.mock("@/lib/google-token", () => ({
  getFreshAccessToken: freshTokenMock,
}));

process.env.APP_URL = "https://example.com";
process.env.CRON_SECRET = "test-secret";

import { GET } from "@/app/api/cron/renew-channels/route";

describe("GET /api/cron/renew-channels", () => {
  beforeEach(() => {
    selectMock.mockReset();
    registerMock.mockClear();
    freshTokenMock.mockClear();
    freshTokenMock.mockResolvedValue("fresh-token");
  });

  it("rejects requests without the correct cron secret", async () => {
    const req = new Request("https://example.com/api/cron/renew-channels");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("renews channels expiring within 24h", async () => {
    selectMock.mockResolvedValue([
      {
        watchChannel: expiringChannel,
        userId: "user-1",
        googleCalendarId: "cal-id",
      },
    ]);

    const req = new Request("https://example.com/api/cron/renew-channels", {
      headers: { authorization: "Bearer test-secret" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(freshTokenMock).toHaveBeenCalledWith("user-1");
    expect(registerMock).toHaveBeenCalledWith(
      "fresh-token",
      "cal-id",
      "https://example.com/api/webhooks/google-calendar",
    );
  });

  it("keeps renewing other users' channels when one user's Google grant is dead", async () => {
    // `getFreshAccessToken` throws (having already flagged that user for
    // reconnect) when their refresh token has been revoked. That must be
    // contained to the one channel, not abort the whole cron run.
    selectMock.mockResolvedValue([
      {
        watchChannel: { ...expiringChannel, id: "wc-dead", channelId: "dead-chan" },
        userId: "revoked-user",
        googleCalendarId: "dead-cal",
      },
      {
        watchChannel: expiringChannel,
        userId: "user-1",
        googleCalendarId: "cal-id",
      },
    ]);
    freshTokenMock.mockRejectedValueOnce(new Error("must be reconnected"));

    const req = new Request("https://example.com/api/cron/renew-channels", {
      headers: { authorization: "Bearer test-secret" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ renewed: 1 });
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith(
      "fresh-token",
      "cal-id",
      "https://example.com/api/webhooks/google-calendar",
    );
  });
});
