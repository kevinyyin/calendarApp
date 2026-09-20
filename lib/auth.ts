import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { authConfig } from "@/lib/auth-config";
import { sessionCallback } from "@/lib/session-callback";
import { withEncryptedTokens } from "@/lib/auth-adapter";
import { createSupabaseRealtimeToken } from "@/lib/supabase-realtime-token";
import { clearNeedsReconnect } from "@/lib/reconnect";

// NOTE: no `accessToken` here, deliberately. Auth.js's database-session
// strategy returns this callback's value verbatim as the body of
// `GET /api/auth/session`, so anything added to `Session` is readable by any
// client-side JavaScript on the page. The Google access token must stay
// server-side (per the spec: tokens are "never sent to the browser") —
// server code reaches it via `getFreshAccessToken(userId)` in
// lib/google-token.ts instead. `supabaseAccessToken` is different: it's a
// short-lived, RLS-scoped Realtime token that is *meant* for the browser —
// see lib/supabase-realtime-token.ts.
declare module "next-auth" {
  interface Session {
    supabaseAccessToken?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: withEncryptedTokens(
    DrizzleAdapter(db, {
      usersTable: schema.users,
      accountsTable: schema.accounts,
      sessionsTable: schema.sessions,
      verificationTokensTable: schema.verificationTokens,
    }),
  ),
  session: { strategy: "database" },
  callbacks: {
    // A fresh successful sign-in means Google just re-issued valid tokens
    // for this user, so any earlier expired/revoked-token flag is stale —
    // clear it here rather than waiting for the next sync to notice.
    async signIn({ user }) {
      if (user.id) {
        await clearNeedsReconnect(user.id);
      }
      return true;
    },
    // `sessionCallback` (lib/session-callback.ts) stays a standalone, pure,
    // unit-tested function that only adds `session.user.id` — see its own
    // doc comment for why it's kept out of this file. The Supabase Realtime
    // token is minted on top of it here because it's signed per-session.
    //
    // There is deliberately no `accounts` lookup here any more: the only
    // reason this callback ever touched that table was to attach the
    // decrypted Google access token to the session, which leaked it to the
    // browser (see the `Session` augmentation above).
    // `createSupabaseRealtimeToken` needs nothing but the user id.
    async session(params) {
      const withId = await sessionCallback(params);
      withId.supabaseAccessToken = createSupabaseRealtimeToken(
        params.user.id,
      );
      return withId;
    },
  },
});
