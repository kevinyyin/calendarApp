import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { authConfig } from "@/lib/auth-config";
import { sessionCallback } from "@/lib/session-callback";
import { withEncryptedTokens } from "@/lib/auth-adapter";

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
    session: sessionCallback,
  },
});
