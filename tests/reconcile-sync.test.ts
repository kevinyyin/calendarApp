import { describe, it, expect, vi, beforeEach } from "vitest";

// `vi.hoisted` is required here: `vi.mock` factories are hoisted above this
// file's other statements (including these `const`s), so referencing a
// plain top-level `const` from inside a factory throws "Cannot access ...
// before initialization" (see tests/renew-channels.test.ts and
// tests/webhook.test.ts for the same pattern).
const { selectMock, incrementalSyncMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  incrementalSyncMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/db/client", () => ({
  db: { select: () => ({ from: () => ({ where: () => selectMock() }) }) },
}));

vi.mock("@/lib/sync", () => ({ runIncrementalSync: incrementalSyncMock }));

process.env.CRON_SECRET = "test-secret";

import { GET } from "@/app/api/cron/reconcile-sync/route";

describe("GET /api/cron/reconcile-sync", () => {
  beforeEach(() => {
    selectMock.mockReset();
    incrementalSyncMock.mockClear();
  });

  it("rejects requests without the correct cron secret", async () => {
    const res = await GET(new Request("https://example.com/api/cron/reconcile-sync"));
    expect(res.status).toBe(401);
  });

  it("runs an incremental sync for every shared calendar", async () => {
    selectMock.mockResolvedValue([{ id: "cal-row-1" }, { id: "cal-row-2" }]);

    const res = await GET(
      new Request("https://example.com/api/cron/reconcile-sync", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(res.status).toBe(200);
    expect(incrementalSyncMock).toHaveBeenCalledWith("cal-row-1");
    expect(incrementalSyncMock).toHaveBeenCalledWith("cal-row-2");
  });

  it("continues past a single calendar's sync failure", async () => {
    selectMock.mockResolvedValue([{ id: "cal-row-1" }, { id: "cal-row-2" }]);
    incrementalSyncMock.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);

    const res = await GET(
      new Request("https://example.com/api/cron/reconcile-sync", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.succeeded).toBe(1);
    expect(body.failed).toBe(1);
  });
});
