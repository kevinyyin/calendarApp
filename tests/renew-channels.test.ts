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
const { selectMock, updateMock, insertMock, deleteMock, registerMock, decryptMock } = vi.hoisted(
  () => ({
    selectMock: vi.fn(),
    updateMock: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => {}) })) })),
    insertMock: vi.fn(() => ({ values: vi.fn(async () => {}) })),
    deleteMock: vi.fn(() => ({ where: vi.fn(async () => {}) })),
    registerMock: vi.fn().mockResolvedValue({
      channelId: "new-chan",
      resourceId: "new-res",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    }),
    // `accounts.access_token` is encrypted at rest (see lib/auth-adapter.ts),
    // so the route decrypts it via `decryptAccountTokens` before use. That
    // decryption is mocked here rather than exercised for real, since it
    // needs `TOKEN_ENCRYPTION_KEY` and actual ciphertext, neither of which
    // this test cares about — only that the decrypted value is what gets
    // passed on to `registerWatchChannel`.
    decryptMock: vi.fn(() => ({ accessToken: "decrypted-token", refreshToken: null })),
  }),
);

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
  stopWatchChannel: vi.fn(),
}));

vi.mock("@/lib/auth-adapter", () => ({
  decryptAccountTokens: decryptMock,
}));

process.env.APP_URL = "https://example.com";
process.env.CRON_SECRET = "test-secret";

import { GET } from "@/app/api/cron/renew-channels/route";

describe("GET /api/cron/renew-channels", () => {
  beforeEach(() => {
    selectMock.mockReset();
    registerMock.mockClear();
    decryptMock.mockClear();
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
        accessToken: "encrypted-token-blob",
        googleCalendarId: "cal-id",
      },
    ]);

    const req = new Request("https://example.com/api/cron/renew-channels", {
      headers: { authorization: "Bearer test-secret" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(decryptMock).toHaveBeenCalledWith({ access_token: "encrypted-token-blob" });
    expect(registerMock).toHaveBeenCalledWith(
      "decrypted-token",
      "cal-id",
      "https://example.com/api/webhooks/google-calendar",
    );
  });
});
