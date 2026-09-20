import { db } from "@/db/client";
import { accounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { decryptAccountTokens } from "@/lib/auth-adapter";
import { encryptToken } from "@/lib/crypto";
import { markNeedsReconnect } from "@/lib/reconnect";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// Refresh this far ahead of the recorded expiry rather than waiting for the
// token to actually lapse: a token that's valid for another 30 seconds when
// we check can still be rejected by Google by the time a multi-page sync
// reaches its last request.
const EXPIRY_SKEW_SECONDS = 5 * 60;

/**
 * Thrown when the user's Google grant is genuinely dead (revoked, expired
 * refresh token, or no refresh token stored at all) rather than a single
 * call having failed. The user has already been flagged via
 * `markNeedsReconnect` when this is thrown, so the reconnect banner will
 * show on their next page load.
 */
export class GoogleReconnectRequiredError extends Error {
  constructor(userId: string, detail: string) {
    super(
      `Google account for user ${userId} must be reconnected: ${detail}`,
    );
    this.name = "GoogleReconnectRequiredError";
  }
}

/**
 * Returns a currently-valid Google access token for `userId`, refreshing it
 * against Google's token endpoint (and persisting the result) when the
 * stored one is expired or close to it.
 *
 * This exists because Auth.js's database-session strategy only calls
 * `linkAccount` on a user's FIRST sign-in: once `getUserByAccount` finds an
 * existing row, Auth.js returns early (see
 * @auth/core/lib/actions/callback/handle-login.js) and never writes the
 * account again. So `accounts.access_token` is frozen at whatever Google
 * issued when the account was first linked, and signing in again does not
 * change that. Every server-side Google API call must go through here rather
 * than reading `accounts.access_token` directly, or it starts failing with
 * 401s roughly an hour after the user first connected.
 */
export async function getFreshAccessToken(userId: string): Promise<string> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")));

  if (!account) {
    throw new Error(`No linked Google account for user ${userId}`);
  }

  const { accessToken, refreshToken } = decryptAccountTokens(account);
  const nowSeconds = Math.floor(Date.now() / 1000);

  // `expires_at` is stored as SECONDS since the epoch: Auth.js computes it
  // as `Math.floor(Date.now() / 1000) + expires_in` before handing the
  // account to the adapter (@auth/core/lib/actions/callback/oauth/callback.js).
  // A null `expires_at` means we have no idea how old the token is, so it is
  // treated as expired rather than optimistically reused.
  if (
    accessToken &&
    typeof account.expires_at === "number" &&
    account.expires_at - EXPIRY_SKEW_SECONDS > nowSeconds
  ) {
    return accessToken;
  }

  if (!refreshToken) {
    await markNeedsReconnect(userId);
    throw new GoogleReconnectRequiredError(
      userId,
      "no refresh token is stored for this account",
    );
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    // A misconfigured deploy, not a dead grant — never flag the user for
    // reconnect over this, they can't fix it by re-consenting.
    throw new Error(
      "AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET must be set to refresh Google access tokens",
    );
  }

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  const payload: {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  } = await response.json().catch(() => ({}));

  if (!response.ok || !payload.access_token) {
    // Google answers `invalid_grant` when the refresh token itself is dead:
    // the user revoked access, changed their password, or the grant expired.
    // Re-consent is the only fix, so flag it. Any other failure (5xx,
    // network hiccup, rate limit) is transient and must NOT show the user a
    // "reconnect" banner they can't act usefully on.
    if (payload.error === "invalid_grant") {
      await markNeedsReconnect(userId);
      throw new GoogleReconnectRequiredError(
        userId,
        payload.error_description ?? "Google returned invalid_grant",
      );
    }
    throw new Error(
      `Google token refresh failed for user ${userId} (HTTP ${response.status}): ${
        payload.error ?? "unknown error"
      }`,
    );
  }

  const expiresAt =
    Math.floor(Date.now() / 1000) + (Number(payload.expires_in) || 3600);

  // Google does NOT return a new refresh_token on every refresh — only
  // persist one when it actually rotated, or the stored (working) one would
  // be clobbered with nothing.
  const patch: {
    access_token: string;
    expires_at: number;
    refresh_token?: string;
  } = {
    access_token: encryptToken(payload.access_token),
    expires_at: expiresAt,
  };
  if (payload.refresh_token) {
    patch.refresh_token = encryptToken(payload.refresh_token);
  }

  await db
    .update(accounts)
    .set(patch)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")));

  return payload.access_token;
}
