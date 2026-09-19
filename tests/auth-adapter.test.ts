import { describe, it, expect, vi, beforeAll } from "vitest";
import type { Adapter, AdapterAccount } from "next-auth/adapters";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
});

import { withEncryptedTokens } from "@/lib/auth-adapter";
import { decryptToken } from "@/lib/crypto";

describe("withEncryptedTokens", () => {
  it("encrypts refresh_token and access_token before delegating to linkAccount", async () => {
    const linkAccount = vi.fn(async (account: AdapterAccount) => account);
    const baseAdapter = { linkAccount } as unknown as Adapter;
    const wrapped = withEncryptedTokens(baseAdapter);

    await wrapped.linkAccount!({
      userId: "user-1",
      type: "oauth",
      provider: "google",
      providerAccountId: "google-123",
      refresh_token: "plain-refresh",
      access_token: "plain-access",
    } as AdapterAccount);

    const passedAccount = linkAccount.mock.calls[0][0] as AdapterAccount;
    expect(passedAccount.refresh_token).not.toBe("plain-refresh");
    expect(decryptToken(passedAccount.refresh_token as string)).toBe(
      "plain-refresh",
    );
    expect(decryptToken(passedAccount.access_token as string)).toBe(
      "plain-access",
    );
  });
});
