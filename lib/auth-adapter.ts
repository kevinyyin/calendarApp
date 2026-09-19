import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { encryptToken, decryptToken } from "@/lib/crypto";

/**
 * Wraps an Auth.js Adapter so OAuth refresh/access tokens are encrypted
 * before they're persisted via `linkAccount`. Google refresh_token and
 * access_token values would otherwise be written to the `accounts` table
 * in plaintext.
 */
export function withEncryptedTokens(adapter: Adapter): Adapter {
  return {
    ...adapter,
    linkAccount(account: AdapterAccount) {
      const toStore: AdapterAccount = {
        ...account,
        refresh_token: account.refresh_token
          ? encryptToken(account.refresh_token)
          : account.refresh_token,
        access_token: account.access_token
          ? encryptToken(account.access_token)
          : account.access_token,
      };
      // Not `async` — returning the delegate's promise directly (rather than
      // through an `async` wrapper) preserves its exact
      // `Promise<void> | Awaitable<AdapterAccount | null | undefined>`
      // return type, which Adapter#linkAccount requires.
      return adapter.linkAccount!(toStore);
    },
  };
}

/** Decrypts the token fields on an account row read back from the database. */
export function decryptAccountTokens(account: {
  refresh_token?: string | null;
  access_token?: string | null;
}) {
  return {
    refreshToken: account.refresh_token
      ? decryptToken(account.refresh_token)
      : null,
    accessToken: account.access_token
      ? decryptToken(account.access_token)
      : null,
  };
}
