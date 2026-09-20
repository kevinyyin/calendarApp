import { describe, it, expect, beforeAll } from "vitest";
import jwt from "jsonwebtoken";

const FAKE_SECRET = "test-supabase-jwt-secret";

beforeAll(() => {
  process.env.SUPABASE_JWT_SECRET = FAKE_SECRET;
});

import { createSupabaseRealtimeToken } from "@/lib/supabase-realtime-token";

describe("createSupabaseRealtimeToken", () => {
  it("mints a JWT with the expected claims", () => {
    const token = createSupabaseRealtimeToken("some-uuid");
    const decoded = jwt.verify(token, FAKE_SECRET) as jwt.JwtPayload;

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
});
