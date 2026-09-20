import { describe, it, expect, vi, beforeEach } from "vitest";

// `vi.mock` factories are hoisted above this file's other statements, so
// referencing plain top-level `const`s from inside the factory throws
// "Cannot access ... before initialization" — `vi.hoisted` is required (see
// tests/renew-channels.test.ts and tests/reconcile-sync.test.ts for the same
// pattern).
const { updateSetMock, updateMock } = vi.hoisted(() => {
  const updateSetMock = vi.fn(() => ({ where: vi.fn(async () => {}) }));
  const updateMock = vi.fn(() => ({ set: updateSetMock }));
  return { updateSetMock, updateMock };
});

vi.mock("@/db/client", () => ({ db: { update: updateMock } }));

import { markNeedsReconnect, clearNeedsReconnect } from "@/lib/reconnect";

describe("reconnect flag helpers", () => {
  beforeEach(() => {
    updateMock.mockClear();
    updateSetMock.mockClear();
  });

  it("markNeedsReconnect sets needsReconnect to true", async () => {
    await markNeedsReconnect("user-1");
    expect(updateSetMock).toHaveBeenCalledWith({ needsReconnect: true });
  });

  it("clearNeedsReconnect sets needsReconnect to false", async () => {
    await clearNeedsReconnect("user-1");
    expect(updateSetMock).toHaveBeenCalledWith({ needsReconnect: false });
  });
});
