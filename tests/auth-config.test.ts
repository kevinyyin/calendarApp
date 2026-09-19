import { describe, it, expect } from "vitest";
import { authConfig } from "@/lib/auth-config";

// The Google() provider factory returns the user-supplied options nested
// under `.options` (Auth.js merges/flattens this into `.authorization` only
// at request time, inside its internal `parseProviders` step) — see
// @auth/core/lib/utils/providers.js. This type reflects the raw shape that
// `authConfig.providers[0]` actually holds before that merge happens.
interface RawGoogleProvider {
  options?: { authorization?: { params?: { scope?: string } } };
}

describe("authConfig", () => {
  it("requests the minimal profile scopes (no calendar scope yet)", () => {
    const google = authConfig.providers[0] as unknown as RawGoogleProvider;
    const scope = google.options?.authorization?.params?.scope ?? "";
    expect(scope).toContain("openid");
    expect(scope).toContain("email");
    expect(scope).not.toContain("calendar");
  });
});
