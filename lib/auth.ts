import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { authConfig } from "@/lib/auth-config";
import { sessionCallback } from "@/lib/session-callback";
import { withEncryptedTokens, decryptAccountTokens } from "@/lib/auth-adapter";
import { eq } from "drizzle-orm";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
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
    // `sessionCallback` (lib/session-callback.ts) stays a standalone, pure,
    // unit-tested function that only adds `session.user.id` — see its own
    // doc comment for why it's kept out of this file. The decrypted
    // access-token lookup below is DB-dependent (it queries `accounts`), so
    // it's composed on top as an additional step rather than folded into
    // `sessionCallback` itself, which would make it untestable the same way.
    async session(params) {
      const withId = await sessionCallback(params);
      const [account] = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.userId, params.user.id));
      if (account) {
        withId.accessToken =
          decryptAccountTokens(account).accessToken ?? undefined;
      }
      return withId;
    },
  },
});
