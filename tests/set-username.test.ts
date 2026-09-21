import { describe, it, expect, vi, beforeEach } from "vitest";

// `vi.mock` factories are hoisted above this file's other statements, so
// referencing plain top-level `const`s from inside the factories throws
// "Cannot access ... before initialization" — `vi.hoisted` is required (see
// tests/toggle-share-calendar.test.ts for the same pattern).
const { authMock, selectWhereMock, updateSetMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  selectWhereMock: vi.fn(async (): Promise<{ id: string; username: string }[]> => []),
  updateSetMock: vi.fn(() => ({ where: vi.fn(async () => {}) })),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: selectWhereMock,
      })),
    })),
    update: vi.fn(() => ({ set: updateSetMock })),
  },
}));

import { setUsername } from "@/app/onboarding/actions";

function makeFormData(username: string) {
  const fd = new FormData();
  fd.set("username", username);
  return fd;
}

describe("setUsername", () => {
  beforeEach(() => {
    authMock.mockReset();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    selectWhereMock.mockReset();
    selectWhereMock.mockResolvedValue([]);
    updateSetMock.mockClear();
  });

  it("rejects an invalid username without touching the database", async () => {
    const result = await setUsername(null, makeFormData("ab"));

    expect(result).toEqual({
      ok: false,
      error: "Username must be at least 3 characters",
    });
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  it("rejects a username already taken by someone else", async () => {
    selectWhereMock.mockResolvedValue([{ id: "user-2", username: "alice" }]);

    const result = await setUsername(null, makeFormData("alice"));

    expect(result).toEqual({ ok: false, error: "Username is already taken" });
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  // The "already taken" check excludes the current user's own row (see the
  // action's comment), so re-saving your own unchanged username — e.g.
  // clicking "Save" on the Friends page without editing the field —
  // succeeds instead of colliding with yourself.
  it("allows saving your own current username unchanged", async () => {
    selectWhereMock.mockResolvedValue([]);

    const result = await setUsername(null, makeFormData("alice"));

    expect(result).toEqual({ ok: true });
    expect(updateSetMock).toHaveBeenCalledWith({ username: "alice" });
  });

  it("sets a new username and returns ok instead of redirecting", async () => {
    const result = await setUsername(null, makeFormData("bob"));

    expect(result).toEqual({ ok: true });
    expect(updateSetMock).toHaveBeenCalledWith({ username: "bob" });
  });
});
