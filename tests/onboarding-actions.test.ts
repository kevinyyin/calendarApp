import { describe, it, expect, vi } from "vitest";

// vi.mock factories are hoisted above imports, so the mock object must be
// created via vi.hoisted() to be visible inside the factory below (a plain
// top-level const here would throw "Cannot access 'dbMock' before
// initialization" at collection time).
const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/db/client", () => ({ db: dbMock }));

// lib/auth.ts calls NextAuth(...) with DrizzleAdapter(db, ...) at module load
// time; DrizzleAdapter uses drizzle-orm's `is()` brand check against `db`,
// which the plain object above doesn't satisfy, and next-auth's own runtime
// module also fails to resolve under Vitest's Node ESM resolver (see its
// `@ts-expect-error` in next-auth/lib/env.js acknowledging Next.js does not
// yet correctly publish `next/server` via package.json#exports). Mocking
// "@/lib/auth" keeps this suite testing only the pure `validateUsername`
// function, without loading any of that real auth/DB machinery.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { validateUsername } from "@/app/onboarding/actions";

describe("validateUsername", () => {
  it("rejects usernames shorter than 3 characters", () => {
    expect(validateUsername("ab")).toEqual({
      ok: false,
      error: "Username must be at least 3 characters",
    });
  });

  it("rejects usernames with invalid characters", () => {
    expect(validateUsername("bad name!")).toEqual({
      ok: false,
      error: "Username can only contain letters, numbers, and underscores",
    });
  });

  it("accepts a valid username", () => {
    expect(validateUsername("kevin_y3")).toEqual({ ok: true });
  });
});
