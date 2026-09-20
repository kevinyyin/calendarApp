import { describe, it, expect, beforeAll, afterEach } from "vitest";
import jwt from "jsonwebtoken";

const FAKE_SECRET = "test-supabase-jwt-secret";

beforeAll(() => {
  process.env.SUPABASE_JWT_SECRET = FAKE_SECRET;
});

import { createSupabaseRealtimeToken } from "@/lib/supabase-realtime-token";

describe("createSupabaseRealtimeToken", () => {
  afterEach(() => {
    // Restore for other tests in this file, since one test below deletes it.
    process.env.SUPABASE_JWT_SECRET = FAKE_SECRET;
  });

  it("mints a JWT with the expected claims", () => {
    const token = createSupabaseRealtimeToken("some-uuid");
    expect(token).toBeDefined();
    const decoded = jwt.verify(token!, FAKE_SECRET) as jwt.JwtPayload;

    expect(decoded.sub).toBe("some-uuid");
    expect(decoded.role).toBe("authenticated");
    expect(decoded.aud).toBe("authenticated");

    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    const secondsUntilExpiry = decoded.exp! - decoded.iat!;
    // expiresIn: "1h" -> exactly 3600 seconds from issued-at.
    expect(secondsUntilExpiry).toBe(3600);

    const nowInSeconds = Math.floor(Date.now() / 1000);
    expect(decoded.exp!).toBeGreaterThan(nowInSeconds);
  });

  it("returns undefined instead of throwing when SUPABASE_JWT_SECRET is unset", () => {
    delete process.env.SUPABASE_JWT_SECRET;
    expect(() => createSupabaseRealtimeToken("some-uuid")).not.toThrow();
    expect(createSupabaseRealtimeToken("some-uuid")).toBeUndefined();
  });
});
