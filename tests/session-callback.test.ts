import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import { sessionCallback } from "@/lib/session-callback";

describe("sessionCallback", () => {
  it("adds the database user's id onto session.user", async () => {
    const session: Session = {
      user: { name: "Kevin", email: "kevin@example.com", image: null },
      expires: "2026-01-01T00:00:00.000Z",
    };
    const user: AdapterUser = {
      id: "user-123",
      email: "kevin@example.com",
      emailVerified: null,
    };

    const result = await sessionCallback({ session, user });

    expect(result.user?.id).toBe("user-123");
  });

  it("preserves other session fields such as expires and existing user fields", async () => {
    const session: Session = {
      user: { name: "Kevin", email: "kevin@example.com", image: null },
      expires: "2026-01-01T00:00:00.000Z",
    };
    const user: AdapterUser = {
      id: "user-123",
      email: "kevin@example.com",
      emailVerified: null,
    };

    const result = await sessionCallback({ session, user });

    expect(result.expires).toBe(session.expires);
    expect(result.user?.name).toBe("Kevin");
    expect(result.user?.email).toBe("kevin@example.com");
  });
});
