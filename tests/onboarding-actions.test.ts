import { describe, it, expect } from "vitest";
import { validateUsername } from "@/app/onboarding/validate-username";

// validateUsername lives in its own module (no "use server", no db/auth
// imports) specifically so it stays a plain, directly-testable function —
// see app/onboarding/validate-username.ts for why it was split out of
// app/onboarding/actions.ts.
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
