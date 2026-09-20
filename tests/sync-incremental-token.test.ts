import { describe, it, expect, vi, beforeEach } from "vitest";

// `vi.mock` factories are hoisted above this file's other statements, so
// `vi.hoisted` is required to reference these from inside them (same pattern
// as tests/renew-channels.test.ts).
const { freshTokenMock, fetchIncrementalMock, selectWhereMock } = vi.hoisted(() => ({
  freshTokenMock: vi.fn(),
  fetchIncrementalMock: vi.fn(),
  selectWhereMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: {
    select: () => ({ from: () => ({ where: selectWhereMock }) }),
    update: () => ({ set: () => ({ where: vi.fn(async () => {}) }) }),
    insert: () => ({ values: () => ({ onConflictDoUpdate: vi.fn(async () => {}) }) }),
    delete: () => ({ where: vi.fn(async () => {}) }),
  },
}));

vi.mock("@/lib/google-calendar-events", () => ({
  fetchIncrementalGoogleEvents: fetchIncrementalMock,
  fetchAllGoogleEvents: vi.fn(),
}));

// The real error class is imported (not redeclared) so the `instanceof`
// check in lib/sync.ts is genuinely exercised rather than approximated.
import { GoogleReconnectRequiredError } from "@/lib/google-token";

vi.mock("@/lib/google-token", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/google-token")>();
  return { ...actual, getFreshAccessToken: freshTokenMock };
});

import { runIncrementalSync } from "@/lib/sync";

const calendarRow = {
  id: "cal-row-1",
  userId: "user-1",
  googleCalendarId: "google-cal-1",
  syncToken: "sync-token-1",
};

describe("runIncrementalSync token acquisition", () => {
  beforeEach(() => {
    freshTokenMock.mockReset();
    fetchIncrementalMock.mockReset();
    selectWhereMock.mockReset();
    selectWhereMock.mockResolvedValue([calendarRow]);
  });

  it("bails quietly when the user's Google grant is dead", async () => {
    // `getFreshAccessToken` has already flagged the user for reconnect, so
    // this is the same user-actionable state the 401/403 path handles.
    // Throwing would make the webhook route answer 500, which has Google
    // retry and eventually drop the push channel.
    freshTokenMock.mockRejectedValue(
      new GoogleReconnectRequiredError("user-1", "Google returned invalid_grant"),
    );

    await expect(runIncrementalSync("cal-row-1")).resolves.toBeUndefined();
    expect(fetchIncrementalMock).not.toHaveBeenCalled();
  });

  it("propagates a transient token failure so it is retried and counted as failed", async () => {
    // A Google outage or a misconfigured deploy is NOT a dead grant: the
    // caller needs to see it (the reconcile cron counts it, the webhook 500s
    // so Google retries).
    freshTokenMock.mockRejectedValue(new Error("Google token refresh failed (HTTP 503)"));

    await expect(runIncrementalSync("cal-row-1")).rejects.toThrow(/503/);
    expect(fetchIncrementalMock).not.toHaveBeenCalled();
  });

  it("syncs with the freshly obtained token on the happy path", async () => {
    freshTokenMock.mockResolvedValue("fresh-token");
    fetchIncrementalMock.mockResolvedValue({ items: [], nextSyncToken: "sync-token-2" });

    await runIncrementalSync("cal-row-1");

    expect(freshTokenMock).toHaveBeenCalledWith("user-1");
    expect(fetchIncrementalMock).toHaveBeenCalledWith(
      "fresh-token",
      "google-cal-1",
      "sync-token-1",
    );
  });
});
