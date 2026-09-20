import { describe, it, expect, vi, beforeEach } from "vitest";

// Set before importing anything that reaches `lib/crypto` / the token
// refresh call: `getKey()` reads TOKEN_ENCRYPTION_KEY at call time, and the
// refresh POST reads the Google client credentials at call time.
process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
process.env.AUTH_GOOGLE_ID = "test-client-id";
process.env.AUTH_GOOGLE_SECRET = "test-client-secret";

// `vi.mock` factories are hoisted above this file's other statements, so
// referencing plain top-level `const`s from inside them throws "Cannot
// access ... before initialization" — `vi.hoisted` is required (same pattern
// as tests/renew-channels.test.ts and tests/reconnect-flag.test.ts).
const { selectWhereMock, updateSetMock, updateWhereMock, markNeedsReconnectMock } =
  vi.hoisted(() => {
    const updateWhereMock = vi.fn(async () => {});
    return {
      selectWhereMock: vi.fn(),
      // Typed via the generic (rather than by naming an unused parameter) so
      // `updateSetMock.mock.calls[0][0]` is the patch object the
      // implementation passed, instead of an empty tuple.
      updateSetMock: vi.fn<
        (patch: Record<string, unknown>) => { where: typeof updateWhereMock }
      >(() => ({ where: updateWhereMock })),
      updateWhereMock,
      markNeedsReconnectMock: vi.fn(async () => {}),
    };
  });

// A straightforward db mock is enough here: unlike tests/friendships.test.ts
// or tests/merged-view.test.ts, the interesting behaviour under test is the
// refresh *decision* and the HTTP call to Google, not the shape of a DB
// predicate — so there's nothing a structural query evaluator would prove
// that this doesn't.
vi.mock("@/db/client", () => ({
  db: {
    select: () => ({ from: () => ({ where: selectWhereMock }) }),
    update: () => ({ set: updateSetMock }),
  },
}));

vi.mock("@/lib/reconnect", () => ({
  markNeedsReconnect: markNeedsReconnectMock,
  clearNeedsReconnect: vi.fn(async () => {}),
}));

// Real encryption, not a mock: the stored columns are genuinely encrypted at
// rest (lib/auth-adapter.ts), so round-tripping through the real cipher is
// what proves getFreshAccessToken decrypts what it reads and encrypts what
// it writes back.
import { encryptToken, decryptToken } from "@/lib/crypto";
import { getFreshAccessToken } from "@/lib/google-token";

const NOW_SECONDS = Math.floor(Date.now() / 1000);

function accountRow(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    provider: "google",
    providerAccountId: "google-1",
    type: "oauth",
    access_token: encryptToken("stored-access-token"),
    refresh_token: encryptToken("stored-refresh-token"),
    expires_at: NOW_SECONDS + 3600,
    ...overrides,
  };
}

describe("getFreshAccessToken", () => {
  beforeEach(() => {
    selectWhereMock.mockReset();
    updateSetMock.mockClear();
    updateWhereMock.mockClear();
    markNeedsReconnectMock.mockClear();
    vi.unstubAllGlobals();
  });

  it("returns the stored access token without calling Google when it is not near expiry", async () => {
    selectWhereMock.mockResolvedValue([accountRow()]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const token = await getFreshAccessToken("user-1");

    expect(token).toBe("stored-access-token");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  it("refreshes and persists a new access token when the stored one is past expiry", async () => {
    // expires_at is stored as SECONDS since epoch (Auth.js computes it as
    // `Math.floor(Date.now() / 1000) + expires_in` — see
    // @auth/core/lib/actions/callback/oauth/callback.js).
    selectWhereMock.mockResolvedValue([accountRow({ expires_at: NOW_SECONDS - 60 })]);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "refreshed-access-token",
        expires_in: 3599,
        token_type: "Bearer",
      }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const token = await getFreshAccessToken("user-1");

    expect(token).toBe("refreshed-access-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("stored-refresh-token");
    expect(body.get("client_id")).toBe("test-client-id");
    expect(body.get("client_secret")).toBe("test-client-secret");

    // Persisted back to the accounts row, encrypted, with a recomputed
    // expiry — otherwise every caller would re-refresh on every call.
    expect(updateSetMock).toHaveBeenCalledTimes(1);
    const patch = updateSetMock.mock.calls[0][0] as unknown as {
      access_token: string;
      expires_at: number;
      refresh_token?: string;
    };
    expect(patch.access_token).not.toBe("refreshed-access-token");
    expect(decryptToken(patch.access_token)).toBe("refreshed-access-token");
    expect(patch.expires_at).toBeGreaterThan(NOW_SECONDS + 3500);
    // Google did not return a new refresh_token, so the stored one must be
    // left untouched rather than overwritten with undefined/null.
    expect(patch.refresh_token).toBeUndefined();
    expect(markNeedsReconnectMock).not.toHaveBeenCalled();
  });

  it("only overwrites the stored refresh token when Google returns a new one", async () => {
    selectWhereMock.mockResolvedValue([accountRow({ expires_at: NOW_SECONDS - 60 })]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "refreshed-access-token",
          expires_in: 3599,
          refresh_token: "rotated-refresh-token",
        }),
        text: async () => "",
      })),
    );

    await getFreshAccessToken("user-1");

    const patch = updateSetMock.mock.calls[0][0] as unknown as {
      refresh_token?: string;
    };
    expect(patch.refresh_token).toBeDefined();
    expect(decryptToken(patch.refresh_token!)).toBe("rotated-refresh-token");
  });

  it("marks the user as needing reconnect and throws when Google reports invalid_grant", async () => {
    selectWhereMock.mockResolvedValue([accountRow({ expires_at: NOW_SECONDS - 60 })]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          error: "invalid_grant",
          error_description: "Token has been expired or revoked.",
        }),
        text: async () => '{"error":"invalid_grant"}',
      })),
    );

    await expect(getFreshAccessToken("user-1")).rejects.toThrow(/reconnect/i);
    expect(markNeedsReconnectMock).toHaveBeenCalledWith("user-1");
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  it("throws without flagging reconnect when the refresh fails for a transient reason", async () => {
    // A 500 from Google's token endpoint does NOT mean the grant is dead, so
    // flagging needsReconnect here would show the user a misleading banner
    // and (worse) train them to re-consent for no reason.
    selectWhereMock.mockResolvedValue([accountRow({ expires_at: NOW_SECONDS - 60 })]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: "internal_failure" }),
        text: async () => "internal_failure",
      })),
    );

    await expect(getFreshAccessToken("user-1")).rejects.toThrow();
    expect(markNeedsReconnectMock).not.toHaveBeenCalled();
  });

  it("flags reconnect when there is no stored refresh token to refresh with", async () => {
    selectWhereMock.mockResolvedValue([
      accountRow({ expires_at: NOW_SECONDS - 60, refresh_token: null }),
    ]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getFreshAccessToken("user-1")).rejects.toThrow(/reconnect/i);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(markNeedsReconnectMock).toHaveBeenCalledWith("user-1");
  });

  it("refreshes when expires_at is missing entirely rather than trusting a token of unknown age", async () => {
    selectWhereMock.mockResolvedValue([accountRow({ expires_at: null })]);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "refreshed-access-token", expires_in: 3599 }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const token = await getFreshAccessToken("user-1");

    expect(token).toBe("refreshed-access-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes when the stored token is inside the 5-minute expiry skew", async () => {
    selectWhereMock.mockResolvedValue([accountRow({ expires_at: NOW_SECONDS + 60 })]);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "refreshed-access-token", expires_in: 3599 }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await getFreshAccessToken("user-1")).toBe("refreshed-access-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when the user has no linked Google account at all", async () => {
    selectWhereMock.mockResolvedValue([]);
    await expect(getFreshAccessToken("user-1")).rejects.toThrow(/no linked google account/i);
  });
});
