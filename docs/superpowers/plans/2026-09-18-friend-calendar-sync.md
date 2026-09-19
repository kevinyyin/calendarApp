# Friend Calendar Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a small web app where a fixed group of friends connect their Google Calendars, share them with each other, see a merged calendar view, and find mutual free time — with near-real-time updates when a friend's Google Calendar changes.

**Architecture:** Next.js (App Router) on Vercel, Auth.js v5 with the Google provider for sign-in and OAuth token storage, Supabase Postgres (via Drizzle ORM) as the database and via Supabase Realtime for live client updates, and a Google Calendar sync engine (webhook push notifications + hourly reconciliation sweep + daily channel renewal) that keeps a local `events` cache which all reads go through.

**Tech Stack:** Next.js 15 (App Router, TypeScript strict), Tailwind CSS, Auth.js v5 (`next-auth@beta`) + `@auth/drizzle-adapter`, Drizzle ORM + `drizzle-kit` + `postgres` (postgres.js) against Supabase Postgres, `googleapis` for the Google Calendar API, `@supabase/supabase-js` for Realtime subscriptions only, Vitest + Testing Library for tests, Node's built-in `crypto` for AES-256-GCM token encryption.

**Spec:** [docs/superpowers/specs/2026-09-18-friend-calendar-sync-design.md](../specs/2026-09-18-friend-calendar-sync-design.md)

## Global Constraints

- Google OAuth scopes: `openid email profile https://www.googleapis.com/auth/calendar.readonly` — read-only, never write to a user's real Google Calendar.
- `accounts.refresh_token` and `accounts.access_token` must be AES-256-GCM encrypted before being persisted, using a key from `TOKEN_ENCRYPTION_KEY`; decrypted only in server-side process memory.
- All UI reads (merged view, slot finder) query the local `events` cache table — never call the Google Calendar API on a page load.
- Sharing is per-calendar (`google_calendars.is_shared`) and friendships are symmetric — no per-friend ACL beyond that.
- The per-viewer merged-view toggle (`merged_view_prefs`) affects only what renders in *that viewer's* merged view; it never affects sharing/visibility rules used by the slot finder.
- Reconciliation sweep runs hourly; channel renewal runs daily; Google watch channels expire ~7 days.
- Package manager: npm.

---

## Phase 0: Project Scaffold

### Task 1: Next.js app scaffold + Tailwind + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `vitest.config.ts`, `.env.example`, `.gitignore`
- Test: `tests/sanity.test.ts`

**Interfaces:**
- Produces: a running Next.js dev server at `app/page.tsx`; a working `npm test` command via Vitest.

- [ ] **Step 1: Scaffold the Next.js app**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --no-turbopack
```

When prompted (if any prompts appear despite flags), accept defaults.

- [ ] **Step 2: Verify the dev server starts**

Run: `npm run dev -- --port 3100 &` then `curl -s http://localhost:3100 | head -5`, then kill the background process.
Expected: HTML output containing `<!DOCTYPE html>`.

- [ ] **Step 3: Add Vitest**

Run:
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

Add to `package.json` `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 4: Write a sanity test**

Create `tests/sanity.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("sanity", () => {
  it("runs the test suite", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: `tests/sanity.test.ts` passes, 1 test.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind and Vitest"
```

---

### Task 2: Database schema foundation (Drizzle + Supabase)

**Files:**
- Create: `db/schema.ts`, `db/client.ts`, `drizzle.config.ts`, `.env.example` (update)
- Modify: `package.json` (add `db:generate`, `db:migrate` scripts)

**Interfaces:**
- Produces: `db` (Drizzle client instance) from `db/client.ts`; table schemas `users`, `accounts`, `sessions`, `verificationTokens` from `db/schema.ts`, matching the Auth.js Drizzle adapter's expected shape, plus a `username` column added to `users`.

- [ ] **Step 1: Install Drizzle and Postgres driver**

Run:
```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

- [ ] **Step 2: Create the Supabase project (if not already provisioned) and record the connection string**

Use the Supabase MCP tools to create a new project (or reuse an existing one the user designates), then fetch its connection string. Set `DATABASE_URL` in `.env.local` to the pooled connection string (port 6543, `?pgbouncer=true`) for the app, and `DIRECT_URL` (port 5432) for migrations.

Add both to `.env.example` with placeholder values:
```
DATABASE_URL="postgres://user:password@host:6543/postgres?pgbouncer=true"
DIRECT_URL="postgres://user:password@host:5432/postgres"
TOKEN_ENCRYPTION_KEY=""
```

- [ ] **Step 3: Write the Auth.js-compatible schema plus `username`**

Create `db/schema.ts`:
```typescript
import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  username: text("username").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);
```

- [ ] **Step 4: Create the Drizzle client**

Create `db/client.ts`:
```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });
```

- [ ] **Step 5: Create `drizzle.config.ts` and add migration scripts**

Create `drizzle.config.ts`:
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
});
```

Add to `package.json` `"scripts"`:
```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate"
```

- [ ] **Step 6: Generate and run the initial migration**

Run:
```bash
npm run db:generate
npm run db:migrate
```
Expected: a new SQL file under `db/migrations/`, and the migration applies successfully against the Supabase database (verify with the Supabase MCP `list_tables` tool showing `users`, `accounts`, `sessions`, `verificationTokens`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Drizzle schema and Supabase Postgres client for Auth.js tables"
```

---

### Task 3: Auth.js sign-in with Google (profile scope only)

**Files:**
- Create: `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `app/login/page.tsx`, `middleware.ts`
- Test: `tests/auth-config.test.ts`

**Interfaces:**
- Consumes: `db` from `db/client.ts` (Task 2).
- Produces: `auth`, `signIn`, `signOut`, `handlers` exported from `lib/auth.ts`, used by later tasks (username onboarding, protected routes) to read `session.user.id`.

- [ ] **Step 1: Install Auth.js v5 and the Drizzle adapter**

Run:
```bash
npm install next-auth@beta @auth/drizzle-adapter
```

- [ ] **Step 2: Write a config-shape test**

Create `tests/auth-config.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { authConfig } from "@/lib/auth-config";

describe("authConfig", () => {
  it("requests the minimal profile scopes (no calendar scope yet)", () => {
    const google = authConfig.providers[0] as any;
    expect(google.authorization.params.scope).toContain("openid");
    expect(google.authorization.params.scope).toContain("email");
    expect(google.authorization.params.scope).not.toContain("calendar");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- tests/auth-config.test.ts`
Expected: FAIL — `Cannot find module '@/lib/auth-config'`.

- [ ] **Step 4: Implement the auth config**

Create `lib/auth-config.ts` (plain config object, kept separate from `lib/auth.ts` so it can be imported in tests without pulling in the Drizzle adapter's Node-only client):
```typescript
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      authorization: {
        params: {
          scope: "openid email profile",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
};
```

Create `lib/auth.ts`:
```typescript
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/client";
import { authConfig } from "@/lib/auth-config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db),
  session: { strategy: "database" },
});
```

Create `app/api/auth/[...nextauth]/route.ts`:
```typescript
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/auth-config.test.ts`
Expected: PASS.

- [ ] **Step 6: Build the login page**

Create `app/login/page.tsx`:
```tsx
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/onboarding" });
        }}
      >
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-6 py-3 text-white"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Add route protection middleware**

Create `middleware.ts`:
```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth"];

export default auth((req) => {
  const isPublic = PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));
  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 8: Manually verify sign-in works**

Set `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `AUTH_SECRET` (via `npx auth secret`) in `.env.local`, using an OAuth client created in Google Cloud Console with `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI. Run `npm run dev`, visit `/login`, sign in, confirm redirect to `/onboarding` (which does not exist yet — a 404 here is expected and fine for this task).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add Auth.js Google sign-in with profile-only scope"
```

---

### Task 4: Username onboarding

**Files:**
- Create: `app/onboarding/page.tsx`, `app/onboarding/actions.ts`
- Test: `tests/onboarding-actions.test.ts`

**Interfaces:**
- Consumes: `auth` from `lib/auth.ts` (Task 3), `db` and `users` from `db/client.ts`/`db/schema.ts` (Task 2).
- Produces: `setUsername(userId: string, username: string): Promise<{ ok: true } | { ok: false; error: string }>` exported from `app/onboarding/actions.ts`, used by the onboarding form.

- [ ] **Step 1: Write the failing test**

Create `tests/onboarding-actions.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  select: vi.fn(),
  update: vi.fn(),
};

vi.mock("@/db/client", () => ({ db: dbMock }));

import { validateUsername } from "@/app/onboarding/actions";

describe("validateUsername", () => {
  it("rejects usernames shorter than 3 characters", () => {
    expect(validateUsername("ab")).toEqual({
      ok: false,
      error: "Username must be at least 3 characters",
    });
  });

  it("rejects usernames with invalid characters", () => {
    expect(validateUsername("bad name!")).toEqual({
      ok: false,
      error: "Username can only contain letters, numbers, and underscores",
    });
  });

  it("accepts a valid username", () => {
    expect(validateUsername("kevin_y3")).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/onboarding-actions.test.ts`
Expected: FAIL with `validateUsername is not exported` or similar.

- [ ] **Step 3: Implement the onboarding server action**

Create `app/onboarding/actions.ts`:
```typescript
"use server";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export function validateUsername(
  username: string,
): { ok: true } | { ok: false; error: string } {
  if (username.length < 3) {
    return { ok: false, error: "Username must be at least 3 characters" };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return {
      ok: false,
      error: "Username can only contain letters, numbers, and underscores",
    };
  }
  return { ok: true };
}

export async function setUsername(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const username = String(formData.get("username") ?? "").trim();
  const validation = validateUsername(username);
  if (!validation.ok) {
    return validation;
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, username));
  if (existing.length > 0) {
    return { ok: false as const, error: "Username is already taken" };
  }

  await db
    .update(users)
    .set({ username })
    .where(eq(users.id, session.user.id));

  redirect("/");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/onboarding-actions.test.ts`
Expected: PASS, all 3 assertions.

- [ ] **Step 5: Build the onboarding page**

Create `app/onboarding/page.tsx`:
```tsx
import { auth } from "@/lib/auth";
import { setUsername } from "./actions";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form action={setUsername} className="flex flex-col gap-3">
        <label htmlFor="username">Choose a username</label>
        <input
          id="username"
          name="username"
          required
          minLength={3}
          pattern="[a-zA-Z0-9_]+"
          className="rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
          Continue
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 6: Manually verify**

Run `npm run dev`, sign in, land on `/onboarding`, submit a username, confirm redirect to `/` and that the `users` row now has `username` set (check via the Supabase MCP `execute_sql` tool or a `select`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add username onboarding flow"
```

---

## Phase 1: Google Calendar Connection & Token Security

### Task 5: Token encryption utility

**Files:**
- Create: `lib/crypto.ts`
- Test: `tests/crypto.test.ts`

**Interfaces:**
- Produces: `encryptToken(plaintext: string): string` and `decryptToken(ciphertext: string): string`, both exported from `lib/crypto.ts`, used by Task 6's adapter wrapper.

- [ ] **Step 1: Write the failing test**

Create `tests/crypto.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

import { encryptToken, decryptToken } from "@/lib/crypto";

describe("token encryption", () => {
  it("round-trips a plaintext string", () => {
    const ciphertext = encryptToken("ya29.example-refresh-token");
    expect(ciphertext).not.toBe("ya29.example-refresh-token");
    expect(decryptToken(ciphertext)).toBe("ya29.example-refresh-token");
  });

  it("produces different ciphertext for the same input each time", () => {
    const a = encryptToken("same-input");
    const b = encryptToken("same-input");
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext", () => {
    const ciphertext = encryptToken("secret");
    const tampered = ciphertext.slice(0, -2) + "aa";
    expect(() => decryptToken(tampered)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/crypto.test.ts`
Expected: FAIL — `Cannot find module '@/lib/crypto'`.

- [ ] **Step 3: Implement the encryption utility**

Create `lib/crypto.ts`:
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return buf;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptToken(ciphertext: string): string {
  const raw = Buffer.from(ciphertext, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = raw.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/crypto.test.ts`
Expected: PASS, all 3 assertions.

- [ ] **Step 5: Generate a real key for local dev and document it**

Run: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`, put the result in `.env.local` as `TOKEN_ENCRYPTION_KEY`. Confirm `.env.example` already has the placeholder (added in Task 2).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add AES-256-GCM token encryption utility"
```

---

### Task 6: Encrypt OAuth tokens at rest + request calendar scope

**Files:**
- Create: `lib/auth-adapter.ts`
- Modify: `lib/auth.ts` (use the wrapped adapter), `lib/auth-config.ts` (scope)
- Test: `tests/auth-adapter.test.ts`

**Interfaces:**
- Consumes: `encryptToken`, `decryptToken` from `lib/crypto.ts` (Task 5).
- Produces: `withEncryptedTokens(adapter: Adapter): Adapter`, exported from `lib/auth-adapter.ts`, wrapping the Drizzle adapter so `linkAccount`/`getUserByAccount` transparently encrypt/decrypt `refresh_token` and `access_token`.

- [ ] **Step 1: Write the failing test**

Create `tests/auth-adapter.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/auth-adapter.test.ts`
Expected: FAIL — `Cannot find module '@/lib/auth-adapter'`.

- [ ] **Step 3: Implement the wrapping adapter**

Create `lib/auth-adapter.ts`:
```typescript
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { encryptToken, decryptToken } from "@/lib/crypto";

export function withEncryptedTokens(adapter: Adapter): Adapter {
  return {
    ...adapter,
    async linkAccount(account: AdapterAccount) {
      const toStore: AdapterAccount = {
        ...account,
        refresh_token: account.refresh_token
          ? encryptToken(account.refresh_token)
          : account.refresh_token,
        access_token: account.access_token
          ? encryptToken(account.access_token)
          : account.access_token,
      };
      return adapter.linkAccount!(toStore);
    },
  };
}

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/auth-adapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the wrapped adapter into `lib/auth.ts` and add the calendar scope**

Modify `lib/auth-config.ts` — change the `scope` param:
```typescript
scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
```

Modify `lib/auth.ts` to wrap the adapter:
```typescript
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/client";
import { authConfig } from "@/lib/auth-config";
import { withEncryptedTokens } from "@/lib/auth-adapter";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: withEncryptedTokens(DrizzleAdapter(db)),
  session: { strategy: "database" },
});
```

- [ ] **Step 6: Manually verify**

Delete any existing linked Google account for your test user (or use a fresh account), sign in again, and confirm via the Supabase MCP `execute_sql` tool that `accounts.refresh_token` is not a plaintext Google token (it should be an opaque base64 blob).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: encrypt OAuth tokens at rest and request calendar.readonly scope"
```

---

### Task 7: Google Calendar API client + calendar list/selection

**Files:**
- Create: `lib/google-calendar.ts`, `app/calendars/page.tsx`, `app/calendars/actions.ts`
- Modify: `db/schema.ts` (re-export calendars table), `lib/auth.ts` (expose decrypted access token helper)
- Test: `tests/google-calendar.test.ts`

**Interfaces:**
- Consumes: `decryptAccountTokens` from `lib/auth-adapter.ts` (Task 6).
- Produces: `listGoogleCalendars(accessToken: string): Promise<{ id: string; summary: string; backgroundColor: string }[]>` from `lib/google-calendar.ts`, used by Task 9's initial sync and this task's UI. `googleCalendars` table exported from `db/schema.ts` with columns `id, userId, googleCalendarId, displayName, color, isShared, syncToken, lastSyncedAt`.

- [ ] **Step 1: Install googleapis**

Run: `npm install googleapis`

- [ ] **Step 2: Write the failing test for the calendar list wrapper**

Create `tests/google-calendar.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

const listMock = vi.fn().mockResolvedValue({
  data: {
    items: [
      { id: "primary", summary: "kevin@example.com", backgroundColor: "#123" },
      { id: "abc123@group.calendar.google.com", summary: "Work", backgroundColor: "#456" },
    ],
  },
});

vi.mock("googleapis", () => ({
  google: {
    calendar: () => ({ calendarList: { list: listMock } }),
    auth: { OAuth2: vi.fn() },
  },
}));

import { listGoogleCalendars } from "@/lib/google-calendar";

describe("listGoogleCalendars", () => {
  it("maps Google's calendarList response to a flat list", async () => {
    const result = await listGoogleCalendars("fake-access-token");
    expect(result).toEqual([
      { id: "primary", summary: "kevin@example.com", backgroundColor: "#123" },
      {
        id: "abc123@group.calendar.google.com",
        summary: "Work",
        backgroundColor: "#456",
      },
    ]);
    expect(listMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/google-calendar.test.ts`
Expected: FAIL — `Cannot find module '@/lib/google-calendar'`.

- [ ] **Step 4: Implement the Google Calendar client wrapper**

Create `lib/google-calendar.ts`:
```typescript
import { google } from "googleapis";

function calendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}

export async function listGoogleCalendars(accessToken: string) {
  const calendar = calendarClient(accessToken);
  const res = await calendar.calendarList.list();
  return (res.data.items ?? []).map((item) => ({
    id: item.id!,
    summary: item.summary!,
    backgroundColor: item.backgroundColor ?? "#888888",
  }));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/google-calendar.test.ts`
Expected: PASS.

- [ ] **Step 6: Add the `google_calendars` table to the schema**

Modify `db/schema.ts`, appending:
```typescript
export const googleCalendars = pgTable("google_calendars", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  googleCalendarId: text("google_calendar_id").notNull(),
  displayName: text("display_name").notNull(),
  color: text("color").notNull(),
  isShared: boolean("is_shared").default(false).notNull(),
  syncToken: text("sync_token"),
  lastSyncedAt: timestamp("last_synced_at"),
});
```

Run:
```bash
npm run db:generate
npm run db:migrate
```
Expected: new migration file created and applied; verify with the Supabase MCP `list_tables` tool.

- [ ] **Step 7: Add a helper to get a fresh decrypted access token for the signed-in user**

Modify `lib/auth.ts` to also export a helper (Auth.js v5's `auth()` already returns a refreshed `session.accessToken` when a `jwt`/`session` callback is set up to decrypt and attach it — add these callbacks):
```typescript
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/client";
import { accounts } from "@/db/schema";
import { authConfig } from "@/lib/auth-config";
import { withEncryptedTokens, decryptAccountTokens } from "@/lib/auth-adapter";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: withEncryptedTokens(DrizzleAdapter(db)),
  session: { strategy: "database" },
  callbacks: {
    async session({ session, user }) {
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, user.id));
      if (account) {
        session.accessToken = decryptAccountTokens(account).accessToken ?? undefined;
      }
      return session;
    },
  },
});
```

Create a module augmentation so `session.accessToken` type-checks — add to `lib/auth.ts`:
```typescript
declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
}
```

- [ ] **Step 8: Build the calendar selection page and server action**

Create `app/calendars/actions.ts`:
```typescript
"use server";

import { db } from "@/db/client";
import { googleCalendars } from "@/db/schema";
import { auth } from "@/lib/auth";
import { listGoogleCalendars } from "@/lib/google-calendar";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getMyGoogleCalendars() {
  const session = await auth();
  if (!session?.user?.id || !session.accessToken) return [];
  return listGoogleCalendars(session.accessToken);
}

export async function getSharedCalendarIds(userId: string) {
  const rows = await db
    .select({ googleCalendarId: googleCalendars.googleCalendarId })
    .from(googleCalendars)
    .where(and(eq(googleCalendars.userId, userId), eq(googleCalendars.isShared, true)));
  return new Set(rows.map((r) => r.googleCalendarId));
}

export async function toggleShareCalendar(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;

  const googleCalendarId = String(formData.get("googleCalendarId"));
  const displayName = String(formData.get("displayName"));
  const color = String(formData.get("color"));
  const enable = formData.get("enable") === "true";

  const existing = await db
    .select()
    .from(googleCalendars)
    .where(
      and(
        eq(googleCalendars.userId, session.user.id),
        eq(googleCalendars.googleCalendarId, googleCalendarId),
      ),
    );

  if (existing.length === 0) {
    await db.insert(googleCalendars).values({
      userId: session.user.id,
      googleCalendarId,
      displayName,
      color,
      isShared: enable,
    });
  } else {
    await db
      .update(googleCalendars)
      .set({ isShared: enable })
      .where(eq(googleCalendars.id, existing[0].id));
  }

  revalidatePath("/calendars");
}
```

Create `app/calendars/page.tsx`:
```tsx
import { getMyGoogleCalendars, getSharedCalendarIds, toggleShareCalendar } from "./actions";
import { auth } from "@/lib/auth";

export default async function CalendarsPage() {
  const session = await auth();
  const calendars = await getMyGoogleCalendars();
  const shared = session?.user?.id
    ? await getSharedCalendarIds(session.user.id)
    : new Set<string>();

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Your Google Calendars</h1>
      <ul className="flex flex-col gap-2">
        {calendars.map((cal) => {
          const isShared = shared.has(cal.id);
          return (
            <li key={cal.id} className="flex items-center justify-between rounded border p-3">
              <span>
                <span
                  className="mr-2 inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: cal.backgroundColor }}
                />
                {cal.summary}
              </span>
              <form action={toggleShareCalendar}>
                <input type="hidden" name="googleCalendarId" value={cal.id} />
                <input type="hidden" name="displayName" value={cal.summary} />
                <input type="hidden" name="color" value={cal.backgroundColor} />
                <input type="hidden" name="enable" value={(!isShared).toString()} />
                <button
                  type="submit"
                  className={`rounded px-3 py-1 text-sm ${
                    isShared ? "bg-slate-200" : "bg-slate-900 text-white"
                  }`}
                >
                  {isShared ? "Sharing" : "Share"}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
```

Note: this task only persists the `is_shared` toggle and the calendar row. Registering the actual Google `watch()` push channel and running the initial sync happen in Task 9 — `toggleShareCalendar` will be extended there.

- [ ] **Step 9: Manually verify**

Run `npm run dev`, visit `/calendars`, confirm your real Google calendars list with correct colors, toggle one to "Sharing", and confirm a row appears in `google_calendars` via the Supabase MCP `execute_sql` tool.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: list Google calendars and let users toggle which to share"
```

---

## Phase 2: Calendar Sync Engine

### Task 8: Events table + initial full sync

**Files:**
- Modify: `db/schema.ts` (add `events` table)
- Create: `lib/google-calendar-events.ts`, `lib/sync.ts`
- Test: `tests/sync.test.ts`

**Interfaces:**
- Consumes: `googleCalendars` from `db/schema.ts` (Task 7); `db` from `db/client.ts` (Task 2).
- Produces: `fetchAllGoogleEvents(accessToken: string, googleCalendarId: string): Promise<{ items: GoogleEvent[]; nextSyncToken: string }>` from `lib/google-calendar-events.ts`; `runInitialSync(calendarRowId: string, accessToken: string): Promise<void>` from `lib/sync.ts`, used by Task 9's `toggleShareCalendar` and Task 11's reconciliation sweep (for the 410 fallback path).

- [ ] **Step 1: Add the `events` table**

Modify `db/schema.ts`, appending:
```typescript
export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  googleCalendarRowId: uuid("google_calendar_row_id")
    .notNull()
    .references(() => googleCalendars.id, { onDelete: "cascade" }),
  googleEventId: text("google_event_id").notNull(),
  title: text("title"),
  description: text("description"),
  location: text("location"),
  startAt: timestamp("start_at", { withTimezone: true }),
  endAt: timestamp("end_at", { withTimezone: true }),
  isAllDay: boolean("is_all_day").default(false).notNull(),
  status: text("status").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

Run:
```bash
npm run db:generate
npm run db:migrate
```

- [ ] **Step 2: Write the failing test for the Google events fetch wrapper**

Create `tests/sync.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const listMock = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    calendar: () => ({ events: { list: listMock } }),
    auth: { OAuth2: vi.fn() },
  },
}));

import { fetchAllGoogleEvents } from "@/lib/google-calendar-events";

describe("fetchAllGoogleEvents", () => {
  beforeEach(() => listMock.mockReset());

  it("paginates through all pages and returns the final sync token", async () => {
    listMock
      .mockResolvedValueOnce({
        data: {
          items: [{ id: "e1", summary: "Standup", status: "confirmed" }],
          nextPageToken: "page2",
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ id: "e2", summary: "Lunch", status: "confirmed" }],
          nextSyncToken: "sync-token-final",
        },
      });

    const result = await fetchAllGoogleEvents("token", "cal-id");

    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe("e1");
    expect(result.items[1].id).toBe("e2");
    expect(result.nextSyncToken).toBe("sync-token-final");
    expect(listMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/sync.test.ts`
Expected: FAIL — `Cannot find module '@/lib/google-calendar-events'`.

- [ ] **Step 4: Implement the paginated fetch wrapper**

Create `lib/google-calendar-events.ts`:
```typescript
import { google, calendar_v3 } from "googleapis";

export type GoogleEvent = calendar_v3.Schema$Event;

function calendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}

export async function fetchAllGoogleEvents(
  accessToken: string,
  googleCalendarId: string,
): Promise<{ items: GoogleEvent[]; nextSyncToken: string }> {
  const calendar = calendarClient(accessToken);
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  const items: GoogleEvent[] = [];

  do {
    const res = await calendar.events.list({
      calendarId: googleCalendarId,
      pageToken,
      singleEvents: true,
      maxResults: 250,
    });
    items.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
    nextSyncToken = res.data.nextSyncToken ?? nextSyncToken;
  } while (pageToken);

  if (!nextSyncToken) {
    throw new Error("Google did not return a nextSyncToken on the final page");
  }

  return { items, nextSyncToken };
}

export async function fetchIncrementalGoogleEvents(
  accessToken: string,
  googleCalendarId: string,
  syncToken: string,
): Promise<{ items: GoogleEvent[]; nextSyncToken: string }> {
  const calendar = calendarClient(accessToken);
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  const items: GoogleEvent[] = [];

  do {
    const res = await calendar.events.list({
      calendarId: googleCalendarId,
      pageToken,
      syncToken: pageToken ? undefined : syncToken,
      singleEvents: true,
      maxResults: 250,
    });
    items.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
    nextSyncToken = res.data.nextSyncToken ?? nextSyncToken;
  } while (pageToken);

  if (!nextSyncToken) {
    throw new Error("Google did not return a nextSyncToken on the final page");
  }

  return { items, nextSyncToken };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/sync.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing test for `upsertEvents` and `runInitialSync`**

Append to `tests/sync.test.ts`:
```typescript
const dbState: { events: any[] } = { events: [] };

vi.mock("@/db/client", () => ({
  db: {
    delete: vi.fn(() => ({ where: vi.fn(async () => { dbState.events = []; }) })),
    insert: vi.fn(() => ({
      values: vi.fn(async (rows: any[]) => {
        dbState.events.push(...(Array.isArray(rows) ? rows : [rows]));
      }),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => {}) })) })),
  },
}));

import { upsertEventsFromGoogle } from "@/lib/sync";

describe("upsertEventsFromGoogle", () => {
  it("maps Google event shape to our events rows", async () => {
    dbState.events = [];
    await upsertEventsFromGoogle("calendar-row-1", [
      {
        id: "e1",
        summary: "Standup",
        description: "daily sync",
        location: "Zoom",
        status: "confirmed",
        start: { dateTime: "2026-09-18T09:00:00-07:00" },
        end: { dateTime: "2026-09-18T09:15:00-07:00" },
      },
    ] as any);

    expect(dbState.events).toHaveLength(1);
    expect(dbState.events[0]).toMatchObject({
      googleCalendarRowId: "calendar-row-1",
      googleEventId: "e1",
      title: "Standup",
      description: "daily sync",
      location: "Zoom",
      isAllDay: false,
      status: "confirmed",
    });
  });

  it("marks all-day events correctly", async () => {
    dbState.events = [];
    await upsertEventsFromGoogle("calendar-row-1", [
      {
        id: "e2",
        summary: "Vacation",
        status: "confirmed",
        start: { date: "2026-09-20" },
        end: { date: "2026-09-22" },
      },
    ] as any);

    expect(dbState.events[0].isAllDay).toBe(true);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- tests/sync.test.ts`
Expected: FAIL — `upsertEventsFromGoogle is not exported`.

- [ ] **Step 8: Implement `upsertEventsFromGoogle` and `runInitialSync`**

Create `lib/sync.ts`:
```typescript
import { db } from "@/db/client";
import { events, googleCalendars } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { GoogleEvent } from "@/lib/google-calendar-events";
import { fetchAllGoogleEvents } from "@/lib/google-calendar-events";

function toEventRow(googleCalendarRowId: string, event: GoogleEvent) {
  const isAllDay = Boolean(event.start?.date);
  return {
    googleCalendarRowId,
    googleEventId: event.id!,
    title: event.summary ?? null,
    description: event.description ?? null,
    location: event.location ?? null,
    startAt: new Date((event.start?.dateTime ?? event.start?.date)!),
    endAt: new Date((event.end?.dateTime ?? event.end?.date)!),
    isAllDay,
    status: event.status ?? "confirmed",
    updatedAt: new Date(),
  };
}

export async function upsertEventsFromGoogle(
  googleCalendarRowId: string,
  googleEvents: GoogleEvent[],
) {
  for (const event of googleEvents) {
    const row = toEventRow(googleCalendarRowId, event);
    if (row.status === "cancelled") {
      await db
        .delete(events)
        .where(eq(events.googleEventId, row.googleEventId));
      continue;
    }
    await db
      .delete(events)
      .where(eq(events.googleEventId, row.googleEventId));
    await db.insert(events).values(row);
  }
}

export async function runInitialSync(calendarRowId: string, accessToken: string) {
  const [calendarRow] = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.id, calendarRowId));
  if (!calendarRow) throw new Error(`Unknown calendar row ${calendarRowId}`);

  const { items, nextSyncToken } = await fetchAllGoogleEvents(
    accessToken,
    calendarRow.googleCalendarId,
  );

  await upsertEventsFromGoogle(calendarRowId, items);

  await db
    .update(googleCalendars)
    .set({ syncToken: nextSyncToken, lastSyncedAt: new Date() })
    .where(eq(googleCalendars.id, calendarRowId));
}
```

Note: the delete-then-insert pattern is used instead of a native upsert here because Drizzle's `onConflictDoUpdate` requires a unique constraint on `google_event_id`; add that constraint now to make this atomic and correct — modify `db/schema.ts`'s `events` table definition to add `.unique()` is not enough alone (it's per-column across all calendars, but `google_event_id` is only unique per calendar). Instead, add a composite unique index: modify the `events` table definition in `db/schema.ts` to:

```typescript
export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    googleCalendarRowId: uuid("google_calendar_row_id")
      .notNull()
      .references(() => googleCalendars.id, { onDelete: "cascade" }),
    googleEventId: text("google_event_id").notNull(),
    title: text("title"),
    description: text("description"),
    location: text("location"),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    isAllDay: boolean("is_all_day").default(false).notNull(),
    status: text("status").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("events_calendar_event_unique").on(
      table.googleCalendarRowId,
      table.googleEventId,
    ),
  ],
);
```

(Add `uniqueIndex` to the `drizzle-orm/pg-core` import list at the top of `db/schema.ts`.) Then simplify `upsertEventsFromGoogle` to a real upsert:
```typescript
import { sql } from "drizzle-orm";

export async function upsertEventsFromGoogle(
  googleCalendarRowId: string,
  googleEvents: GoogleEvent[],
) {
  for (const event of googleEvents) {
    const row = toEventRow(googleCalendarRowId, event);
    if (row.status === "cancelled") {
      await db
        .delete(events)
        .where(eq(events.googleEventId, row.googleEventId));
      continue;
    }
    await db
      .insert(events)
      .values(row)
      .onConflictDoUpdate({
        target: [events.googleCalendarRowId, events.googleEventId],
        set: {
          title: row.title,
          description: row.description,
          location: row.location,
          startAt: row.startAt,
          endAt: row.endAt,
          isAllDay: row.isAllDay,
          status: row.status,
          updatedAt: row.updatedAt,
        },
      });
  }
}
```

Run:
```bash
npm run db:generate
npm run db:migrate
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- tests/sync.test.ts`
Expected: PASS, all 3 tests (pagination + 2 upsert-shape tests).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add events table and initial full sync"
```

---

### Task 9: Wire initial sync + Google watch() into calendar sharing, add webhook endpoint

**Files:**
- Modify: `app/calendars/actions.ts` (call `runInitialSync` + register watch channel on share-on; stop channel on share-off)
- Create: `db/schema-watch.ts` (fold into `db/schema.ts`), `lib/google-watch.ts`, `app/api/webhooks/google-calendar/route.ts`
- Test: `tests/google-watch.test.ts`, `tests/webhook.test.ts`

**Interfaces:**
- Consumes: `runInitialSync` from `lib/sync.ts` (Task 8).
- Produces: `registerWatchChannel(accessToken: string, googleCalendarId: string, webhookUrl: string): Promise<{ channelId: string; resourceId: string; expiresAt: Date }>` and `stopWatchChannel(accessToken: string, channelId: string, resourceId: string): Promise<void>` from `lib/google-watch.ts`, used by Task 10's renewal cron. `watchChannels` table exported from `db/schema.ts`.

- [ ] **Step 1: Add the `watch_channels` table**

Modify `db/schema.ts`, appending:
```typescript
export const watchChannels = pgTable("watch_channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  googleCalendarRowId: uuid("google_calendar_row_id")
    .notNull()
    .references(() => googleCalendars.id, { onDelete: "cascade" }),
  channelId: text("channel_id").notNull(),
  resourceId: text("resource_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
```

Run:
```bash
npm run db:generate
npm run db:migrate
```

- [ ] **Step 2: Write the failing test for the watch channel wrapper**

Create `tests/google-watch.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

const watchMock = vi.fn().mockResolvedValue({
  data: { id: "chan-1", resourceId: "res-1", expiration: "1758300000000" },
});
const stopMock = vi.fn().mockResolvedValue({});

vi.mock("googleapis", () => ({
  google: {
    calendar: () => ({
      events: { watch: watchMock },
      channels: { stop: stopMock },
    }),
    auth: { OAuth2: vi.fn() },
  },
}));

import { registerWatchChannel, stopWatchChannel } from "@/lib/google-watch";

describe("registerWatchChannel", () => {
  it("calls events.watch and returns parsed expiration", async () => {
    const result = await registerWatchChannel(
      "token",
      "cal-id",
      "https://example.com/api/webhooks/google-calendar",
    );
    expect(watchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: "cal-id",
        requestBody: expect.objectContaining({
          type: "web_hook",
          address: "https://example.com/api/webhooks/google-calendar",
        }),
      }),
    );
    expect(result.channelId).toBe("chan-1");
    expect(result.resourceId).toBe("res-1");
    expect(result.expiresAt).toEqual(new Date(1758300000000));
  });
});

describe("stopWatchChannel", () => {
  it("calls channels.stop with the channel and resource id", async () => {
    await stopWatchChannel("token", "chan-1", "res-1");
    expect(stopMock).toHaveBeenCalledWith({
      requestBody: { id: "chan-1", resourceId: "res-1" },
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/google-watch.test.ts`
Expected: FAIL — `Cannot find module '@/lib/google-watch'`.

- [ ] **Step 4: Implement the watch channel wrapper**

Create `lib/google-watch.ts`:
```typescript
import { google } from "googleapis";
import { randomUUID } from "crypto";

function calendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}

export async function registerWatchChannel(
  accessToken: string,
  googleCalendarId: string,
  webhookUrl: string,
) {
  const calendar = calendarClient(accessToken);
  const res = await calendar.events.watch({
    calendarId: googleCalendarId,
    requestBody: {
      id: randomUUID(),
      type: "web_hook",
      address: webhookUrl,
    },
  });
  return {
    channelId: res.data.id!,
    resourceId: res.data.resourceId!,
    expiresAt: new Date(Number(res.data.expiration)),
  };
}

export async function stopWatchChannel(
  accessToken: string,
  channelId: string,
  resourceId: string,
) {
  const calendar = calendarClient(accessToken);
  await calendar.channels.stop({
    requestBody: { id: channelId, resourceId },
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/google-watch.test.ts`
Expected: PASS, both tests.

- [ ] **Step 6: Write the failing test for the webhook handler**

Create `tests/webhook.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const incrementalSyncMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/sync", () => ({ runIncrementalSync: incrementalSyncMock }));

const findChannelMock = vi.fn();
vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => findChannelMock(),
      }),
    }),
  },
}));

import { POST } from "@/app/api/webhooks/google-calendar/route";

describe("POST /api/webhooks/google-calendar", () => {
  beforeEach(() => {
    incrementalSyncMock.mockClear();
    findChannelMock.mockReset();
  });

  it("triggers an incremental sync for a known channel", async () => {
    findChannelMock.mockResolvedValue([
      { googleCalendarRowId: "cal-row-1", channelId: "chan-1" },
    ]);

    const req = new Request("https://example.com/api/webhooks/google-calendar", {
      method: "POST",
      headers: {
        "x-goog-channel-id": "chan-1",
        "x-goog-resource-state": "exists",
      },
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(incrementalSyncMock).toHaveBeenCalledWith("cal-row-1");
  });

  it("returns 404 for an unknown channel without erroring", async () => {
    findChannelMock.mockResolvedValue([]);

    const req = new Request("https://example.com/api/webhooks/google-calendar", {
      method: "POST",
      headers: { "x-goog-channel-id": "unknown-chan" },
    });

    const res = await POST(req);

    expect(res.status).toBe(404);
    expect(incrementalSyncMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- tests/webhook.test.ts`
Expected: FAIL — `runIncrementalSync is not exported` and route module missing.

- [ ] **Step 8: Implement `runIncrementalSync` (stub for now, completed in this step) and the webhook route**

Append to `lib/sync.ts`:
```typescript
import { fetchIncrementalGoogleEvents } from "@/lib/google-calendar-events";
import { decryptAccountTokens } from "@/lib/auth-adapter";
import { accounts } from "@/db/schema";

async function getAccessTokenForCalendarOwner(userId: string): Promise<string> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));
  if (!account) throw new Error(`No linked Google account for user ${userId}`);
  const { accessToken } = decryptAccountTokens(account);
  if (!accessToken) throw new Error(`No access token for user ${userId}`);
  return accessToken;
}

export async function runIncrementalSync(calendarRowId: string) {
  const [calendarRow] = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.id, calendarRowId));
  if (!calendarRow) throw new Error(`Unknown calendar row ${calendarRowId}`);
  if (!calendarRow.syncToken) {
    throw new Error(`Calendar ${calendarRowId} has no sync token; run initial sync first`);
  }

  const accessToken = await getAccessTokenForCalendarOwner(calendarRow.userId);

  try {
    const { items, nextSyncToken } = await fetchIncrementalGoogleEvents(
      accessToken,
      calendarRow.googleCalendarId,
      calendarRow.syncToken,
    );
    await upsertEventsFromGoogle(calendarRowId, items);
    await db
      .update(googleCalendars)
      .set({ syncToken: nextSyncToken, lastSyncedAt: new Date() })
      .where(eq(googleCalendars.id, calendarRowId));
  } catch (err: any) {
    if (err?.code === 410) {
      await runInitialSync(calendarRowId, accessToken);
      return;
    }
    throw err;
  }
}
```

Create `app/api/webhooks/google-calendar/route.ts`:
```typescript
import { db } from "@/db/client";
import { watchChannels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runIncrementalSync } from "@/lib/sync";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const channelId = req.headers.get("x-goog-channel-id");
  if (!channelId) {
    return NextResponse.json({ error: "missing channel id" }, { status: 400 });
  }

  const [channel] = await db
    .select()
    .from(watchChannels)
    .where(eq(watchChannels.channelId, channelId));

  if (!channel) {
    return NextResponse.json({ error: "unknown channel" }, { status: 404 });
  }

  await runIncrementalSync(channel.googleCalendarRowId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- tests/webhook.test.ts`
Expected: PASS, both tests.

- [ ] **Step 10: Wire initial sync + watch registration into `toggleShareCalendar`**

Modify `app/calendars/actions.ts`'s `toggleShareCalendar`, replacing the body after the insert/update block with:
```typescript
  const [calendarRow] = await db
    .select()
    .from(googleCalendars)
    .where(
      and(
        eq(googleCalendars.userId, session.user.id),
        eq(googleCalendars.googleCalendarId, googleCalendarId),
      ),
    );

  if (enable && session.accessToken) {
    await runInitialSync(calendarRow.id, session.accessToken);
    const webhookUrl = `${process.env.APP_URL}/api/webhooks/google-calendar`;
    const channel = await registerWatchChannel(
      session.accessToken,
      googleCalendarId,
      webhookUrl,
    );
    await db.insert(watchChannels).values({
      googleCalendarRowId: calendarRow.id,
      channelId: channel.channelId,
      resourceId: channel.resourceId,
      expiresAt: channel.expiresAt,
    });
  } else if (!enable && session.accessToken) {
    const [existingChannel] = await db
      .select()
      .from(watchChannels)
      .where(eq(watchChannels.googleCalendarRowId, calendarRow.id));
    if (existingChannel) {
      await stopWatchChannel(
        session.accessToken,
        existingChannel.channelId,
        existingChannel.resourceId,
      );
      await db.delete(watchChannels).where(eq(watchChannels.id, existingChannel.id));
    }
  }

  revalidatePath("/calendars");
```

Add the necessary imports to the top of `app/calendars/actions.ts`:
```typescript
import { watchChannels } from "@/db/schema";
import { runInitialSync } from "@/lib/sync";
import { registerWatchChannel, stopWatchChannel } from "@/lib/google-watch";
```

Add `APP_URL` to `.env.example` and `.env.local` (e.g. `http://localhost:3000` for local dev — note Google cannot reach a `localhost` webhook, so real webhook delivery is only verifiable once deployed to Vercel; local dev testing of this path is covered by the automated tests above and by manual verification in Task 21 against the deployed app).

- [ ] **Step 11: Manually verify (deployed environment only)**

After Vercel deployment (Task 19 covers deployment config), toggle a calendar on, confirm a `watch_channels` row appears, then edit that calendar's event in Google Calendar directly and confirm (via Supabase MCP `execute_sql`) that the corresponding `events` row updates within a few seconds.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: register Google watch channels and handle push notifications"
```

---

### Task 10: Channel renewal cron

**Files:**
- Create: `app/api/cron/renew-channels/route.ts`
- Modify: `vercel.json` (cron schedule)
- Test: `tests/renew-channels.test.ts`

**Interfaces:**
- Consumes: `registerWatchChannel`, `stopWatchChannel` from `lib/google-watch.ts` (Task 9).
- Produces: none consumed by later tasks (terminal cron endpoint).

- [ ] **Step 1: Write the failing test**

Create `tests/renew-channels.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const expiringChannel = {
  id: "wc-1",
  googleCalendarRowId: "cal-row-1",
  channelId: "old-chan",
  resourceId: "old-res",
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12), // 12h from now
};

const selectMock = vi.fn();
const updateMock = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => {}) })) }));
const insertMock = vi.fn(() => ({ values: vi.fn(async () => {}) }));
const deleteMock = vi.fn(() => ({ where: vi.fn(async () => {}) }));

vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => selectMock(),
        }),
      }),
    }),
    update: updateMock,
    insert: insertMock,
    delete: deleteMock,
  },
}));

const registerMock = vi.fn().mockResolvedValue({
  channelId: "new-chan",
  resourceId: "new-res",
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
});
vi.mock("@/lib/google-watch", () => ({
  registerWatchChannel: registerMock,
  stopWatchChannel: vi.fn(),
}));

process.env.APP_URL = "https://example.com";
process.env.CRON_SECRET = "test-secret";

import { GET } from "@/app/api/cron/renew-channels/route";

describe("GET /api/cron/renew-channels", () => {
  beforeEach(() => {
    selectMock.mockReset();
    registerMock.mockClear();
  });

  it("rejects requests without the correct cron secret", async () => {
    const req = new Request("https://example.com/api/cron/renew-channels");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("renews channels expiring within 24h", async () => {
    selectMock.mockResolvedValue([
      {
        watchChannel: expiringChannel,
        accessToken: "decrypted-token",
        googleCalendarId: "cal-id",
      },
    ]);

    const req = new Request("https://example.com/api/cron/renew-channels", {
      headers: { authorization: "Bearer test-secret" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(registerMock).toHaveBeenCalledWith(
      "decrypted-token",
      "cal-id",
      "https://example.com/api/webhooks/google-calendar",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/renew-channels.test.ts`
Expected: FAIL — route module missing.

- [ ] **Step 3: Implement the renewal cron route**

Create `app/api/cron/renew-channels/route.ts`:
```typescript
import { db } from "@/db/client";
import { watchChannels, googleCalendars, accounts } from "@/db/schema";
import { eq, lt, and } from "drizzle-orm";
import { registerWatchChannel, stopWatchChannel } from "@/lib/google-watch";
import { decryptAccountTokens } from "@/lib/auth-adapter";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const expiringSoon = new Date(Date.now() + 1000 * 60 * 60 * 24);

  const rows = await db
    .select({
      watchChannel: watchChannels,
      googleCalendarId: googleCalendars.googleCalendarId,
      userId: googleCalendars.userId,
    })
    .from(watchChannels)
    .innerJoin(googleCalendars, eq(watchChannels.googleCalendarRowId, googleCalendars.id))
    .where(lt(watchChannels.expiresAt, expiringSoon));

  for (const row of rows) {
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, row.userId));
    if (!account) continue;
    const { accessToken } = decryptAccountTokens(account);
    if (!accessToken) continue;

    const webhookUrl = `${process.env.APP_URL}/api/webhooks/google-calendar`;
    const fresh = await registerWatchChannel(accessToken, row.googleCalendarId, webhookUrl);

    await db.insert(watchChannels).values({
      googleCalendarRowId: row.watchChannel.googleCalendarRowId,
      channelId: fresh.channelId,
      resourceId: fresh.resourceId,
      expiresAt: fresh.expiresAt,
    });

    await stopWatchChannel(
      accessToken,
      row.watchChannel.channelId,
      row.watchChannel.resourceId,
    ).catch(() => {});
    await db.delete(watchChannels).where(eq(watchChannels.id, row.watchChannel.id));
  }

  return NextResponse.json({ renewed: rows.length }, { status: 200 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/renew-channels.test.ts`
Expected: PASS, both tests.

- [ ] **Step 5: Configure the Vercel Cron schedule**

Create `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/renew-channels", "schedule": "0 3 * * *" },
    { "path": "/api/cron/reconcile-sync", "schedule": "0 * * * *" }
  ]
}
```

Add `CRON_SECRET` to `.env.example`; set it in Vercel project environment variables and note that Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is configured as a Vercel env var (Vercel injects this itself — confirm current behavior against Vercel's cron docs at implementation time, since this project's `route.ts` above assumes that header is present).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add daily Google watch channel renewal cron"
```

---

### Task 11: Reconciliation sweep cron

**Files:**
- Create: `app/api/cron/reconcile-sync/route.ts`
- Test: `tests/reconcile-sync.test.ts`

**Interfaces:**
- Consumes: `runIncrementalSync` from `lib/sync.ts` (Task 9).

- [ ] **Step 1: Write the failing test**

Create `tests/reconcile-sync.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const selectMock = vi.fn();
vi.mock("@/db/client", () => ({
  db: { select: () => ({ from: () => ({ where: () => selectMock() }) }) },
}));

const incrementalSyncMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/sync", () => ({ runIncrementalSync: incrementalSyncMock }));

process.env.CRON_SECRET = "test-secret";

import { GET } from "@/app/api/cron/reconcile-sync/route";

describe("GET /api/cron/reconcile-sync", () => {
  beforeEach(() => {
    selectMock.mockReset();
    incrementalSyncMock.mockClear();
  });

  it("rejects requests without the correct cron secret", async () => {
    const res = await GET(new Request("https://example.com/api/cron/reconcile-sync"));
    expect(res.status).toBe(401);
  });

  it("runs an incremental sync for every shared calendar", async () => {
    selectMock.mockResolvedValue([{ id: "cal-row-1" }, { id: "cal-row-2" }]);

    const res = await GET(
      new Request("https://example.com/api/cron/reconcile-sync", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(res.status).toBe(200);
    expect(incrementalSyncMock).toHaveBeenCalledWith("cal-row-1");
    expect(incrementalSyncMock).toHaveBeenCalledWith("cal-row-2");
  });

  it("continues past a single calendar's sync failure", async () => {
    selectMock.mockResolvedValue([{ id: "cal-row-1" }, { id: "cal-row-2" }]);
    incrementalSyncMock.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);

    const res = await GET(
      new Request("https://example.com/api/cron/reconcile-sync", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.succeeded).toBe(1);
    expect(body.failed).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reconcile-sync.test.ts`
Expected: FAIL — route module missing.

- [ ] **Step 3: Implement the reconciliation route**

Create `app/api/cron/reconcile-sync/route.ts`:
```typescript
import { db } from "@/db/client";
import { googleCalendars } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runIncrementalSync } from "@/lib/sync";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sharedCalendars = await db
    .select({ id: googleCalendars.id })
    .from(googleCalendars)
    .where(eq(googleCalendars.isShared, true));

  let succeeded = 0;
  let failed = 0;

  for (const cal of sharedCalendars) {
    try {
      await runIncrementalSync(cal.id);
      succeeded++;
    } catch (err) {
      console.error(`Reconciliation sync failed for calendar ${cal.id}`, err);
      failed++;
    }
  }

  return NextResponse.json({ succeeded, failed }, { status: 200 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reconcile-sync.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add hourly reconciliation sync sweep as webhook safety net"
```

---

## Phase 3: Friends & Sharing

### Task 12: Friend requests

**Files:**
- Modify: `db/schema.ts` (add `friendships` table)
- Create: `lib/friendships.ts`, `app/friends/page.tsx`, `app/friends/actions.ts`
- Test: `tests/friendships.test.ts`

**Interfaces:**
- Produces: `sendFriendRequest(requesterId: string, recipientUsername: string): Promise<{ ok: true } | { ok: false; error: string }>`, `respondToFriendRequest(friendshipId: string, userId: string, accept: boolean): Promise<{ ok: true } | { ok: false; error: string }>`, `getAcceptedFriendIds(userId: string): Promise<string[]>` — all from `lib/friendships.ts`, used by Task 13's visibility helper and the friends UI.

- [ ] **Step 1: Add the `friendships` table**

Modify `db/schema.ts`, appending:
```typescript
export const friendships = pgTable("friendships", {
  id: uuid("id").defaultRandom().primaryKey(),
  requesterId: uuid("requester_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  recipientId: uuid("recipient_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // "pending" | "accepted"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
});
```

Run:
```bash
npm run db:generate
npm run db:migrate
```

- [ ] **Step 2: Write the failing tests**

Create `tests/friendships.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  users: [
    { id: "user-a", username: "alice" },
    { id: "user-b", username: "bob" },
  ],
  friendships: [] as any[],
};

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: any) => ({
        where: vi.fn(async () => {
          if (table.__name === "users") return state.users;
          return state.friendships;
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (row: any) => {
        state.friendships.push({ id: `f-${state.friendships.length + 1}`, ...row });
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((patch: any) => ({
        where: vi.fn(async () => {
          Object.assign(state.friendships[0], patch);
        }),
      })),
    })),
  },
}));

vi.mock("@/db/schema", () => ({
  users: { __name: "users" },
  friendships: { __name: "friendships" },
}));

import { sendFriendRequest, respondToFriendRequest } from "@/lib/friendships";

describe("sendFriendRequest", () => {
  beforeEach(() => {
    state.friendships = [];
  });

  it("returns an error when the username does not exist", async () => {
    const result = await sendFriendRequest("user-a", "nobody");
    expect(result).toEqual({ ok: false, error: "No user found with that username" });
  });

  it("creates a pending friendship for a valid username", async () => {
    const result = await sendFriendRequest("user-a", "bob");
    expect(result).toEqual({ ok: true });
    expect(state.friendships).toHaveLength(1);
    expect(state.friendships[0]).toMatchObject({
      requesterId: "user-a",
      recipientId: "user-b",
      status: "pending",
    });
  });
});

describe("respondToFriendRequest", () => {
  beforeEach(() => {
    state.friendships = [
      { id: "f-1", requesterId: "user-a", recipientId: "user-b", status: "pending" },
    ];
  });

  it("marks the friendship accepted when the recipient accepts", async () => {
    const result = await respondToFriendRequest("f-1", "user-b", true);
    expect(result).toEqual({ ok: true });
    expect(state.friendships[0].status).toBe("accepted");
  });
});
```

Note: this test's mock is simplified (it doesn't perfectly model Drizzle's chained query builder for every case) — it is meant to pin down the *contract* of `lib/friendships.ts`'s exported functions. Adjust the mock shape as needed while implementing so it accurately reflects how your real query code calls `db.select().from().where()`, keeping assertions on the final returned value and on `state.friendships`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/friendships.test.ts`
Expected: FAIL — `Cannot find module '@/lib/friendships'`.

- [ ] **Step 4: Implement `lib/friendships.ts`**

Create `lib/friendships.ts`:
```typescript
import { db } from "@/db/client";
import { users, friendships } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";

export async function sendFriendRequest(
  requesterId: string,
  recipientUsername: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [recipient] = await db
    .select()
    .from(users)
    .where(eq(users.username, recipientUsername));

  if (!recipient) {
    return { ok: false, error: "No user found with that username" };
  }
  if (recipient.id === requesterId) {
    return { ok: false, error: "You cannot friend yourself" };
  }

  await db.insert(friendships).values({
    requesterId,
    recipientId: recipient.id,
    status: "pending",
  });

  return { ok: true };
}

export async function respondToFriendRequest(
  friendshipId: string,
  userId: string,
  accept: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [friendship] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId));

  if (!friendship || friendship.recipientId !== userId) {
    return { ok: false, error: "Friend request not found" };
  }

  await db
    .update(friendships)
    .set({
      status: accept ? "accepted" : "declined",
      respondedAt: new Date(),
    })
    .where(eq(friendships.id, friendshipId));

  return { ok: true };
}

export async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  const rows = await db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, userId), eq(friendships.recipientId, userId)),
      ),
    );

  return rows.map((f) => (f.requesterId === userId ? f.recipientId : f.requesterId));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/friendships.test.ts`
Expected: PASS. If the simplified mock from Step 2 doesn't line up with the real query shape, adjust the mock (not the implementation) until it does — the implementation above is the source of truth for the contract.

- [ ] **Step 6: Build the friends UI**

Create `app/friends/actions.ts`:
```typescript
"use server";

import { auth } from "@/lib/auth";
import { sendFriendRequest as sendFriendRequestLib, respondToFriendRequest as respondLib } from "@/lib/friendships";
import { revalidatePath } from "next/cache";

export async function sendFriendRequestAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const username = String(formData.get("username"));
  await sendFriendRequestLib(session.user.id, username);
  revalidatePath("/friends");
}

export async function respondToFriendRequestAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const friendshipId = String(formData.get("friendshipId"));
  const accept = formData.get("accept") === "true";
  await respondLib(friendshipId, session.user.id, accept);
  revalidatePath("/friends");
}
```

Create `app/friends/page.tsx`:
```tsx
import { db } from "@/db/client";
import { friendships, users } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { sendFriendRequestAction, respondToFriendRequestAction } from "./actions";

export default async function FriendsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const pendingIncoming = await db
    .select({ id: friendships.id, requesterUsername: users.username })
    .from(friendships)
    .innerJoin(users, eq(friendships.requesterId, users.id))
    .where(and(eq(friendships.recipientId, userId), eq(friendships.status, "pending")));

  const accepted = await db
    .select({ friendUsername: users.username })
    .from(friendships)
    .innerJoin(
      users,
      or(
        and(eq(friendships.requesterId, userId), eq(users.id, friendships.recipientId)),
        and(eq(friendships.recipientId, userId), eq(users.id, friendships.requesterId)),
      ),
    )
    .where(and(eq(friendships.status, "accepted"), or(eq(friendships.requesterId, userId), eq(friendships.recipientId, userId))));

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Friends</h1>

      <form action={sendFriendRequestAction} className="mb-6 flex gap-2">
        <input name="username" placeholder="username" required className="rounded border px-3 py-2" />
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
          Send request
        </button>
      </form>

      <h2 className="mb-2 font-medium">Pending requests</h2>
      <ul className="mb-6 flex flex-col gap-2">
        {pendingIncoming.map((req) => (
          <li key={req.id} className="flex items-center justify-between rounded border p-3">
            <span>{req.requesterUsername}</span>
            <div className="flex gap-2">
              <form action={respondToFriendRequestAction}>
                <input type="hidden" name="friendshipId" value={req.id} />
                <input type="hidden" name="accept" value="true" />
                <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-sm text-white">
                  Accept
                </button>
              </form>
              <form action={respondToFriendRequestAction}>
                <input type="hidden" name="friendshipId" value={req.id} />
                <input type="hidden" name="accept" value="false" />
                <button type="submit" className="rounded bg-slate-200 px-3 py-1 text-sm">
                  Decline
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mb-2 font-medium">Friends</h2>
      <ul className="flex flex-col gap-2">
        {accepted.map((f, i) => (
          <li key={i} className="rounded border p-3">
            {f.friendUsername}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 7: Manually verify**

With two real test accounts (or two Google test users), sign in as each in separate browsers, send a friend request by username, accept it, confirm both show up in each other's "Friends" list.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add friend requests and accept/decline flow"
```

---

### Task 13: Calendar visibility helper

**Files:**
- Create: `lib/visibility.ts`
- Test: `tests/visibility.test.ts`

**Interfaces:**
- Consumes: `getAcceptedFriendIds` from `lib/friendships.ts` (Task 12).
- Produces: `getVisibleCalendars(viewerId: string): Promise<{ id: string; userId: string; displayName: string; color: string }[]>` from `lib/visibility.ts`, used by Task 14's merged view and Task 17's slot finder.

- [ ] **Step 1: Write the failing test**

Create `tests/visibility.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/friendships", () => ({
  getAcceptedFriendIds: vi.fn(async (userId: string) =>
    userId === "viewer" ? ["friend-1", "friend-2"] : [],
  ),
}));

const calendarRows = [
  { id: "cal-1", userId: "friend-1", displayName: "Work", color: "#111", isShared: true },
  { id: "cal-2", userId: "friend-1", displayName: "Personal", color: "#222", isShared: false },
  { id: "cal-3", userId: "friend-2", displayName: "Team", color: "#333", isShared: true },
  { id: "cal-4", userId: "not-a-friend", displayName: "Random", color: "#444", isShared: true },
];

vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => calendarRows,
      }),
    }),
  },
}));

import { getVisibleCalendars } from "@/lib/visibility";

describe("getVisibleCalendars", () => {
  it("returns only shared calendars belonging to accepted friends", async () => {
    const result = await getVisibleCalendars("viewer");
    expect(result.map((c) => c.id)).toEqual(["cal-1", "cal-3"]);
  });

  it("returns an empty list for a viewer with no friends", async () => {
    const result = await getVisibleCalendars("loner");
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/visibility.test.ts`
Expected: FAIL — `Cannot find module '@/lib/visibility'`.

- [ ] **Step 3: Implement `lib/visibility.ts`**

Create `lib/visibility.ts`:
```typescript
import { db } from "@/db/client";
import { googleCalendars } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAcceptedFriendIds } from "@/lib/friendships";

export async function getVisibleCalendars(viewerId: string) {
  const friendIds = await getAcceptedFriendIds(viewerId);
  if (friendIds.length === 0) return [];

  const friendIdSet = new Set(friendIds);
  const allShared = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.isShared, true));

  return allShared.filter((cal) => friendIdSet.has(cal.userId));
}
```

Note: the test's mock for `db.select().from().where()` returns *all* rows regardless of the `where` predicate passed in, so filtering by `isShared` happens implicitly by including `isShared: true/false` fixture rows and asserting the real implementation's `.where(eq(googleCalendars.isShared, true))` call — since the mock ignores the predicate and returns everything, this specific test relies on the friend-ID filter done in application code (`friendIdSet.has`) to exclude `cal-2` and `cal-4` correctly (`cal-2` is excluded because it's `isShared: false` in a *real* DB query, but here it's excluded because... re-check: `cal-2` belongs to `friend-1`, who IS a friend, so the friend-filter alone wouldn't exclude it). Adjust the mock in Step 1 to actually respect the `where` clause (filter `calendarRows` by `isShared === true` inside the mocked `where`), so the test genuinely exercises both the DB-level shared-only filter and the application-level friend filter. Fix the mock before finalizing this task.

- [ ] **Step 4: Fix the mock and run tests to verify they pass**

Update the `where` mock in `tests/visibility.test.ts` to:
```typescript
vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => calendarRows.filter((c) => c.isShared),
      }),
    }),
  },
}));
```

Run: `npm test -- tests/visibility.test.ts`
Expected: PASS, both tests (`cal-2` now excluded by the mocked `isShared` filter, `cal-4` excluded by the friend-ID filter).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add calendar visibility helper for friends' shared calendars"
```

---

## Phase 4: Merged View & Real-Time Updates

### Task 14: Merged calendar view + per-viewer toggle

**Files:**
- Modify: `db/schema.ts` (add `mergedViewPrefs` table)
- Create: `lib/merged-view.ts`, `app/page.tsx` (replace scaffold homepage), `app/actions/merged-view.ts`, `components/CalendarGrid.tsx`
- Test: `tests/merged-view.test.ts`

**Interfaces:**
- Consumes: `getVisibleCalendars` from `lib/visibility.ts` (Task 13).
- Produces: `getMergedViewEvents(viewerId: string, range: { start: Date; end: Date }): Promise<{ personUserId: string; personLabel: string; color: string; title: string; startAt: Date; endAt: Date }[]>` from `lib/merged-view.ts`, used by `app/page.tsx` and Task 15's realtime subscription (to know which calendar rows to listen to).

- [ ] **Step 1: Add the `merged_view_prefs` table**

Modify `db/schema.ts`, appending:
```typescript
export const mergedViewPrefs = pgTable(
  "merged_view_prefs",
  {
    viewerId: uuid("viewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendId: uuid("friend_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isVisible: boolean("is_visible").default(true).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.viewerId, table.friendId] })],
);
```

Run:
```bash
npm run db:generate
npm run db:migrate
```

- [ ] **Step 2: Write the failing test**

Create `tests/merged-view.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/visibility", () => ({
  getVisibleCalendars: vi.fn(async () => [
    { id: "cal-1", userId: "friend-1", displayName: "Work", color: "#111" },
    { id: "cal-2", userId: "friend-2", displayName: "Team", color: "#222" },
  ]),
}));

const prefsRows = [{ friendId: "friend-2", isVisible: false }];
const eventRows = [
  {
    googleCalendarRowId: "cal-1",
    title: "Standup",
    startAt: new Date("2026-09-18T09:00:00Z"),
    endAt: new Date("2026-09-18T09:15:00Z"),
  },
  {
    googleCalendarRowId: "cal-2",
    title: "Planning",
    startAt: new Date("2026-09-18T10:00:00Z"),
    endAt: new Date("2026-09-18T11:00:00Z"),
  },
];

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: any) => ({
        where: vi.fn(async () => (table.__name === "prefs" ? prefsRows : eventRows)),
      })),
    })),
  },
}));

vi.mock("@/db/schema", () => ({
  mergedViewPrefs: { __name: "prefs" },
  events: { __name: "events" },
}));

import { getMergedViewEvents } from "@/lib/merged-view";

describe("getMergedViewEvents", () => {
  it("excludes events from a calendar whose owner is toggled off", async () => {
    const result = await getMergedViewEvents("viewer", {
      start: new Date("2026-09-18T00:00:00Z"),
      end: new Date("2026-09-19T00:00:00Z"),
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Standup");
    expect(result[0].personUserId).toBe("friend-1");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/merged-view.test.ts`
Expected: FAIL — `Cannot find module '@/lib/merged-view'`.

- [ ] **Step 4: Implement `lib/merged-view.ts`**

Create `lib/merged-view.ts`:
```typescript
import { db } from "@/db/client";
import { events, mergedViewPrefs } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getVisibleCalendars } from "@/lib/visibility";

export async function getMergedViewEvents(
  viewerId: string,
  range: { start: Date; end: Date },
) {
  const visibleCalendars = await getVisibleCalendars(viewerId);

  const prefs = await db
    .select()
    .from(mergedViewPrefs)
    .where(eq(mergedViewPrefs.viewerId, viewerId));
  const hiddenFriendIds = new Set(
    prefs.filter((p) => !p.isVisible).map((p) => p.friendId),
  );

  const visibleAfterToggle = visibleCalendars.filter(
    (cal) => !hiddenFriendIds.has(cal.userId),
  );

  const results = [];
  for (const cal of visibleAfterToggle) {
    const rows = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.googleCalendarRowId, cal.id),
          gte(events.startAt, range.start),
          lte(events.endAt, range.end),
        ),
      );
    for (const row of rows) {
      results.push({
        personUserId: cal.userId,
        personLabel: cal.displayName,
        color: cal.color,
        title: row.title ?? "(untitled)",
        startAt: row.startAt!,
        endAt: row.endAt!,
      });
    }
  }
  return results;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/merged-view.test.ts`
Expected: PASS. Note the test's mocked `db.select().from().where()` ignores date-range filtering — that's acceptable since the date filtering is a straightforward Drizzle `and(gte, lte)` clause covered by manual verification, and the test's actual purpose (proving the per-friend toggle excludes events) doesn't depend on it.

- [ ] **Step 6: Build the merged view toggle action**

Create `app/actions/merged-view.ts`:
```typescript
"use server";

import { db } from "@/db/client";
import { mergedViewPrefs } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function toggleFriendVisibility(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;

  const friendId = String(formData.get("friendId"));
  const visible = formData.get("visible") === "true";

  const existing = await db
    .select()
    .from(mergedViewPrefs)
    .where(
      and(
        eq(mergedViewPrefs.viewerId, session.user.id),
        eq(mergedViewPrefs.friendId, friendId),
      ),
    );

  if (existing.length === 0) {
    await db.insert(mergedViewPrefs).values({
      viewerId: session.user.id,
      friendId,
      isVisible: visible,
    });
  } else {
    await db
      .update(mergedViewPrefs)
      .set({ isVisible: visible, updatedAt: new Date() })
      .where(
        and(
          eq(mergedViewPrefs.viewerId, session.user.id),
          eq(mergedViewPrefs.friendId, friendId),
        ),
      );
  }

  revalidatePath("/");
}
```

- [ ] **Step 7: Build the merged view page**

Create `components/CalendarGrid.tsx`:
```tsx
type MergedEvent = {
  personUserId: string;
  personLabel: string;
  color: string;
  title: string;
  startAt: Date;
  endAt: Date;
};

export function CalendarGrid({ events }: { events: MergedEvent[] }) {
  const sorted = [...events].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((event, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded border p-3"
          style={{ borderLeftColor: event.color, borderLeftWidth: 4 }}
        >
          <span className="text-sm text-slate-500">
            {event.startAt.toLocaleString()} – {event.endAt.toLocaleTimeString()}
          </span>
          <span className="font-medium">{event.title}</span>
          <span className="text-sm text-slate-400">({event.personLabel})</span>
        </li>
      ))}
    </ul>
  );
}
```

Replace `app/page.tsx`:
```tsx
import { auth } from "@/lib/auth";
import { getMergedViewEvents } from "@/lib/merged-view";
import { getVisibleCalendars } from "@/lib/visibility";
import { CalendarGrid } from "@/components/CalendarGrid";
import { toggleFriendVisibility } from "@/app/actions/merged-view";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [events, visibleCalendars] = await Promise.all([
    getMergedViewEvents(session.user.id, { start: now, end: weekFromNow }),
    getVisibleCalendars(session.user.id),
  ]);

  const friendsByUserId = new Map(
    visibleCalendars.map((c) => [c.userId, c.displayName]),
  );

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold">This week</h1>
      <div className="mb-6 flex gap-2">
        {[...friendsByUserId.entries()].map(([friendId, label]) => (
          <form key={friendId} action={toggleFriendVisibility}>
            <input type="hidden" name="friendId" value={friendId} />
            <input type="hidden" name="visible" value="false" />
            <button type="submit" className="rounded bg-slate-100 px-3 py-1 text-sm">
              Hide {label}
            </button>
          </form>
        ))}
      </div>
      <CalendarGrid events={events} />
    </main>
  );
}
```

- [ ] **Step 8: Manually verify**

Sign in as a user with at least one accepted friend sharing a calendar with events this week; confirm the merged view lists both your own and your friend's events, and that clicking "Hide" removes that friend's events after the page reloads.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add merged calendar view with per-viewer friend visibility toggle"
```

---

### Task 15: Live updates via Supabase Realtime

**Files:**
- Create: `lib/supabase-client.ts`, `components/RealtimeMergedView.tsx`
- Modify: `app/page.tsx` (use the realtime-aware client component for the event list)
- Test: `tests/realtime-merged-view.test.tsx`

**Interfaces:**
- Consumes: `MergedEvent` shape from Task 14's `CalendarGrid`.
- Produces: none consumed by later tasks (leaf UI feature).

- [ ] **Step 1: Install the Supabase JS client and enable Realtime on the `events` table**

Run: `npm install @supabase/supabase-js`

Using the Supabase MCP tools, run SQL to enable Realtime replication on the `events` table (Supabase's Realtime feature streams Postgres changes for tables added to the `supabase_realtime` publication):
```sql
alter publication supabase_realtime add table events;
```

- [ ] **Step 2: Add the Supabase client for the browser**

Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.example` and `.env.local` (fetch via the Supabase MCP `get_project_url` and `get_publishable_keys` tools).

Create `lib/supabase-client.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";

export function createBrowserSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Write the failing test for the realtime component's merge logic**

Create `tests/realtime-merged-view.test.tsx`:
```typescript
import { describe, it, expect } from "vitest";
import { mergeIncomingEvent } from "@/components/RealtimeMergedView";

const calendarMeta = {
  "cal-1": { personUserId: "friend-1", personLabel: "Alice", color: "#111" },
};

describe("mergeIncomingEvent", () => {
  it("adds a new event to the list when its calendar is known", () => {
    const result = mergeIncomingEvent([], calendarMeta, {
      id: "e1",
      title: "New meeting",
      startAt: "2026-09-18T09:00:00Z",
      endAt: "2026-09-18T09:30:00Z",
      googleCalendarRowId: "cal-1",
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      personUserId: "friend-1",
      personLabel: "Alice",
      color: "#111",
      title: "New meeting",
    });
  });

  it("replaces an existing event with the same id", () => {
    const existing = [
      {
        id: "e1",
        personUserId: "friend-1",
        personLabel: "Alice",
        color: "#111",
        title: "Old title",
        startAt: new Date("2026-09-18T09:00:00Z"),
        endAt: new Date("2026-09-18T09:30:00Z"),
      },
    ];
    const result = mergeIncomingEvent(existing, calendarMeta, {
      id: "e1",
      title: "Updated title",
      startAt: "2026-09-18T09:00:00Z",
      endAt: "2026-09-18T09:30:00Z",
      googleCalendarRowId: "cal-1",
    });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Updated title");
  });

  it("ignores an incoming event for a calendar not in the known-metadata map", () => {
    const result = mergeIncomingEvent([], calendarMeta, {
      id: "e2",
      title: "Unknown calendar's event",
      startAt: "2026-09-18T09:00:00Z",
      endAt: "2026-09-18T09:30:00Z",
      googleCalendarRowId: "cal-unrelated",
    });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- tests/realtime-merged-view.test.tsx`
Expected: FAIL — `Cannot find module '@/components/RealtimeMergedView'`.

- [ ] **Step 5: Implement the realtime-aware client component**

The raw Postgres row from the `events` table (via `postgres_changes`) carries only `id`, `title`, `start_at`, `end_at`, `google_calendar_row_id` — it has no `personUserId`/`personLabel`/`color`, since those live on `google_calendars`, not `events`. So the component needs a calendar-row-id → person-metadata map (built from `getVisibleCalendars`'s output) to turn a raw incoming row into the same shape `CalendarGrid`'s `MergedEvent` expects (defined in Task 14).

Create `components/RealtimeMergedView.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-client";

type RawIncomingRow = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  googleCalendarRowId: string;
};

type CalendarMeta = {
  personUserId: string;
  personLabel: string;
  color: string;
};

type MergedEventWithId = {
  id: string;
  personUserId: string;
  personLabel: string;
  color: string;
  title: string;
  startAt: Date;
  endAt: Date;
};

export function mergeIncomingEvent(
  existing: MergedEventWithId[],
  calendarMetaByRowId: Record<string, CalendarMeta>,
  incoming: RawIncomingRow,
): MergedEventWithId[] {
  const meta = calendarMetaByRowId[incoming.googleCalendarRowId];
  if (!meta) return existing;

  const withoutOld = existing.filter((e) => e.id !== incoming.id);
  return [
    ...withoutOld,
    {
      id: incoming.id,
      personUserId: meta.personUserId,
      personLabel: meta.personLabel,
      color: meta.color,
      title: incoming.title,
      startAt: new Date(incoming.startAt),
      endAt: new Date(incoming.endAt),
    },
  ];
}

export function RealtimeMergedView({
  initialEvents,
  calendarMetaByRowId,
  children,
}: {
  initialEvents: MergedEventWithId[];
  calendarMetaByRowId: Record<string, CalendarMeta>;
  children: (events: MergedEventWithId[]) => React.ReactNode;
}) {
  const [rows, setRows] = useState(initialEvents);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("events-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        (payload) => {
          const row = (payload.new ?? payload.old) as any;
          setRows((prev) =>
            mergeIncomingEvent(prev, calendarMetaByRowId, {
              id: row.id,
              title: row.title,
              startAt: row.start_at,
              endAt: row.end_at,
              googleCalendarRowId: row.google_calendar_row_id,
            }),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [calendarMetaByRowId]);

  return <>{children(rows)}</>;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/realtime-merged-view.test.tsx`
Expected: PASS, all 3 tests.

- [ ] **Step 7: Wire into the homepage**

First, modify `lib/merged-view.ts`'s `getMergedViewEvents` (Task 14) so each returned object also includes `id: row.id` and `googleCalendarRowId: row.googleCalendarRowId` (both already available on `row` from the existing `events` query — just add the two fields to the object literal being pushed into `results`). This does not change the function's existing test assertions (Task 14's test only checks `result[0].title` and `result[0].personUserId`), so no test edit is needed.

Then modify `app/page.tsx` to build a `calendarMetaByRowId` map from `visibleCalendars` (keyed by each calendar's `id`, valued `{ personUserId: cal.userId, personLabel: cal.displayName, color: cal.color }`), and wrap the existing `<CalendarGrid events={events} />` with `RealtimeMergedView`:
```tsx
import { RealtimeMergedView } from "@/components/RealtimeMergedView";

// ...inside HomePage, after events/visibleCalendars are fetched:
const calendarMetaByRowId = Object.fromEntries(
  visibleCalendars.map((c) => [
    c.id,
    { personUserId: c.userId, personLabel: c.displayName, color: c.color },
  ]),
);

// ...replace the `<CalendarGrid events={events} />` line with:
<RealtimeMergedView
  initialEvents={events.map((e) => ({ ...e, id: e.id }))}
  calendarMetaByRowId={calendarMetaByRowId}
>
  {(liveEvents) => <CalendarGrid events={liveEvents} />}
</RealtimeMergedView>
```

Confirm `npm test` still passes after this wiring change (it only touches `app/page.tsx`, which has no direct unit test, plus the two-field addition to `lib/merged-view.ts`, already covered above).

- [ ] **Step 8: Manually verify**

With the app deployed (or two `npm run dev` tabs open against the same Supabase project), edit a friend's shared event directly in Google Calendar, wait for the webhook/reconciliation sync to update the `events` row, and confirm the merged view updates in an already-open browser tab without a manual refresh.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: push live event updates to open merged-view tabs via Supabase Realtime"
```

---

## Phase 5: Free-Slot Finder

### Task 16: Free-slot computation

**Files:**
- Create: `lib/free-slots.ts`
- Test: `tests/free-slots.test.ts`

**Interfaces:**
- Produces: `findFreeSlots(busyIntervalsByPerson: { start: Date; end: Date }[][], range: { start: Date; end: Date }, durationMinutes: number, wakingHours?: { startHour: number; endHour: number }): { start: Date; end: Date }[]` from `lib/free-slots.ts`, used by Task 17's slot finder API route. This is a pure function — no DB, no Google API — so it's fully unit-testable in isolation.

- [ ] **Step 1: Write the failing tests**

Create `tests/free-slots.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { findFreeSlots } from "@/lib/free-slots";

function d(iso: string) {
  return new Date(iso);
}

describe("findFreeSlots", () => {
  it("finds a single gap between two people's non-overlapping busy blocks", () => {
    const busy = [
      [{ start: d("2026-09-18T09:00:00Z"), end: d("2026-09-18T10:00:00Z") }],
      [{ start: d("2026-09-18T13:00:00Z"), end: d("2026-09-18T14:00:00Z") }],
    ];
    const slots = findFreeSlots(
      busy,
      { start: d("2026-09-18T08:00:00Z"), end: d("2026-09-18T16:00:00Z") },
      60,
    );
    expect(slots).toContainEqual({ start: d("2026-09-18T10:00:00Z"), end: d("2026-09-18T13:00:00Z") });
  });

  it("excludes slots shorter than the requested duration", () => {
    const busy = [
      [{ start: d("2026-09-18T09:00:00Z"), end: d("2026-09-18T09:45:00Z") }],
      [{ start: d("2026-09-18T10:15:00Z"), end: d("2026-09-18T11:00:00Z") }],
    ];
    // Only a 30-minute gap (09:45-10:15) exists; requesting 60 minutes should find nothing there.
    const slots = findFreeSlots(
      busy,
      { start: d("2026-09-18T09:00:00Z"), end: d("2026-09-18T11:00:00Z") },
      60,
    );
    expect(slots).toEqual([]);
  });

  it("merges back-to-back and overlapping busy blocks for the same person before computing gaps", () => {
    const busy = [
      [
        { start: d("2026-09-18T09:00:00Z"), end: d("2026-09-18T10:00:00Z") },
        { start: d("2026-09-18T10:00:00Z"), end: d("2026-09-18T11:00:00Z") }, // back-to-back
        { start: d("2026-09-18T10:30:00Z"), end: d("2026-09-18T11:30:00Z") }, // overlapping
      ],
    ];
    const slots = findFreeSlots(
      busy,
      { start: d("2026-09-18T09:00:00Z"), end: d("2026-09-18T13:00:00Z") },
      60,
    );
    expect(slots).toEqual([
      { start: d("2026-09-18T11:30:00Z"), end: d("2026-09-18T13:00:00Z") },
    ]);
  });

  it("treats an all-day event as busy for the full day within range", () => {
    const busy = [
      [{ start: d("2026-09-18T00:00:00Z"), end: d("2026-09-19T00:00:00Z") }],
    ];
    const slots = findFreeSlots(
      busy,
      { start: d("2026-09-18T00:00:00Z"), end: d("2026-09-19T00:00:00Z") },
      30,
    );
    expect(slots).toEqual([]);
  });

  it("returns an empty list when there are no people (nothing to be mutually free with)", () => {
    const slots = findFreeSlots(
      [],
      { start: d("2026-09-18T09:00:00Z"), end: d("2026-09-18T17:00:00Z") },
      30,
    );
    expect(slots).toEqual([]);
  });

  it("respects the waking-hours window, clipping gaps to it", () => {
    const busy: { start: Date; end: Date }[][] = [[]];
    const slots = findFreeSlots(
      busy,
      { start: d("2026-09-18T00:00:00Z"), end: d("2026-09-19T00:00:00Z") },
      60,
      { startHour: 8, endHour: 22 },
    );
    expect(slots).toEqual([
      { start: d("2026-09-18T08:00:00Z"), end: d("2026-09-18T22:00:00Z") },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/free-slots.test.ts`
Expected: FAIL — `Cannot find module '@/lib/free-slots'`.

- [ ] **Step 3: Implement `findFreeSlots`**

Create `lib/free-slots.ts`:
```typescript
export type Interval = { start: Date; end: Date };

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [sorted[0]];

  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (current.start.getTime() <= last.end.getTime()) {
      if (current.end.getTime() > last.end.getTime()) {
        last.end = current.end;
      }
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function clipToWakingHours(
  range: Interval,
  wakingHours: { startHour: number; endHour: number },
): Interval[] {
  const days: Interval[] = [];
  const cursor = new Date(range.start);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor.getTime() < range.end.getTime()) {
    const dayStart = new Date(cursor);
    dayStart.setUTCHours(wakingHours.startHour, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setUTCHours(wakingHours.endHour, 0, 0, 0);

    const clippedStart = new Date(Math.max(dayStart.getTime(), range.start.getTime()));
    const clippedEnd = new Date(Math.min(dayEnd.getTime(), range.end.getTime()));
    if (clippedStart.getTime() < clippedEnd.getTime()) {
      days.push({ start: clippedStart, end: clippedEnd });
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

export function findFreeSlots(
  busyIntervalsByPerson: Interval[][],
  range: Interval,
  durationMinutes: number,
  wakingHours: { startHour: number; endHour: number } = { startHour: 0, endHour: 24 },
): Interval[] {
  if (busyIntervalsByPerson.length === 0) return [];

  const allBusy = mergeIntervals(busyIntervalsByPerson.flat());
  const durationMs = durationMinutes * 60 * 1000;
  const windows = clipToWakingHours(range, wakingHours);

  const freeSlots: Interval[] = [];

  for (const window of windows) {
    let cursor = window.start;
    for (const busy of allBusy) {
      if (busy.end.getTime() <= cursor.getTime() || busy.start.getTime() >= window.end.getTime()) {
        continue;
      }
      if (busy.start.getTime() > cursor.getTime()) {
        const gapEnd = new Date(Math.min(busy.start.getTime(), window.end.getTime()));
        if (gapEnd.getTime() - cursor.getTime() >= durationMs) {
          freeSlots.push({ start: new Date(cursor), end: gapEnd });
        }
      }
      if (busy.end.getTime() > cursor.getTime()) {
        cursor = new Date(busy.end);
      }
    }
    if (cursor.getTime() < window.end.getTime() && window.end.getTime() - cursor.getTime() >= durationMs) {
      freeSlots.push({ start: new Date(cursor), end: new Date(window.end) });
    }
  }

  return freeSlots;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/free-slots.test.ts`
Expected: PASS, all 6 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add free-slot gap computation with waking-hours support"
```

---

### Task 17: Slot finder UI

**Files:**
- Create: `app/find-time/page.tsx`, `app/find-time/actions.ts`
- Test: `tests/find-time-actions.test.ts`

**Interfaces:**
- Consumes: `getVisibleCalendars` from `lib/visibility.ts` (Task 13); `findFreeSlots` from `lib/free-slots.ts` (Task 16).

- [ ] **Step 1: Write the failing test**

Create `tests/find-time-actions.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

const eventRows = [
  { googleCalendarRowId: "cal-friend-a", startAt: new Date("2026-09-18T09:00:00Z"), endAt: new Date("2026-09-18T10:00:00Z") },
  { googleCalendarRowId: "cal-friend-b", startAt: new Date("2026-09-18T13:00:00Z"), endAt: new Date("2026-09-18T14:00:00Z") },
];

vi.mock("@/db/client", () => ({
  db: { select: () => ({ from: () => ({ where: async () => eventRows }) }) },
}));

vi.mock("@/lib/visibility", () => ({
  getVisibleCalendars: vi.fn(async () => [
    { id: "cal-friend-a", userId: "friend-a", displayName: "A", color: "#111" },
    { id: "cal-friend-b", userId: "friend-b", displayName: "B", color: "#222" },
  ]),
}));

import { findMutualFreeSlots } from "@/app/find-time/actions";

describe("findMutualFreeSlots", () => {
  it("groups busy intervals per person before computing gaps", async () => {
    const slots = await findMutualFreeSlots("viewer", {
      friendUserIds: ["friend-a", "friend-b"],
      start: new Date("2026-09-18T08:00:00Z"),
      end: new Date("2026-09-18T16:00:00Z"),
      durationMinutes: 60,
    });

    expect(slots).toContainEqual({
      start: new Date("2026-09-18T10:00:00Z"),
      end: new Date("2026-09-18T13:00:00Z"),
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/find-time-actions.test.ts`
Expected: FAIL — `findMutualFreeSlots is not exported`.

- [ ] **Step 3: Implement the server action**

Create `app/find-time/actions.ts`:
```typescript
"use server";

import { db } from "@/db/client";
import { events } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { getVisibleCalendars } from "@/lib/visibility";
import { findFreeSlots, type Interval } from "@/lib/free-slots";

export async function findMutualFreeSlots(
  viewerId: string,
  options: {
    friendUserIds: string[];
    start: Date;
    end: Date;
    durationMinutes: number;
  },
): Promise<Interval[]> {
  const visibleCalendars = await getVisibleCalendars(viewerId);
  const relevantCalendars = visibleCalendars.filter((c) =>
    options.friendUserIds.includes(c.userId),
  );

  const busyByPerson = new Map<string, Interval[]>();
  for (const cal of relevantCalendars) {
    if (!busyByPerson.has(cal.userId)) busyByPerson.set(cal.userId, []);
  }

  if (relevantCalendars.length > 0) {
    const rows = await db
      .select()
      .from(events)
      .where(inArray(events.googleCalendarRowId, relevantCalendars.map((c) => c.id)));

    const calendarRowIdToUserId = new Map(
      relevantCalendars.map((c) => [c.id, c.userId]),
    );

    for (const row of rows) {
      const userId = calendarRowIdToUserId.get(row.googleCalendarRowId);
      if (!userId || !row.startAt || !row.endAt) continue;
      busyByPerson.get(userId)!.push({ start: row.startAt, end: row.endAt });
    }
  }

  return findFreeSlots(
    Array.from(busyByPerson.values()),
    { start: options.start, end: options.end },
    options.durationMinutes,
    { startHour: 8, endHour: 22 },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/find-time-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the slot finder page**

Create `app/find-time/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { findMutualFreeSlots } from "./actions";

export default function FindTimePage() {
  const [slots, setSlots] = useState<{ start: Date; end: Date }[]>([]);
  const [friendUsernames, setFriendUsernames] = useState("");
  const [duration, setDuration] = useState(60);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // NOTE: this client component calls a server action that expects friend
    // *user ids*, not usernames — Task 17 Step 6 below adds a lookup step.
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">Find a time</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          placeholder="friend usernames, comma-separated"
          value={friendUsernames}
          onChange={(e) => setFriendUsernames(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
          Find slots
        </button>
      </form>
      <ul className="mt-4 flex flex-col gap-2">
        {slots.map((slot, i) => (
          <li key={i} className="rounded border p-3">
            {slot.start.toLocaleString()} – {slot.end.toLocaleTimeString()}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 6: Add a username-to-userId lookup and wire the form to the server action**

Add to `app/find-time/actions.ts`:
```typescript
import { db as dbClient } from "@/db/client";
import { users } from "@/db/schema";
import { inArray as inArrayUsers } from "drizzle-orm";

export async function resolveUsernamesToUserIds(usernames: string[]): Promise<string[]> {
  if (usernames.length === 0) return [];
  const rows = await dbClient
    .select({ id: users.id })
    .from(users)
    .where(inArrayUsers(users.username, usernames));
  return rows.map((r) => r.id);
}

export async function findMutualFreeSlotsByUsername(
  viewerId: string,
  options: {
    friendUsernames: string[];
    start: Date;
    end: Date;
    durationMinutes: number;
  },
): Promise<Interval[]> {
  const friendUserIds = await resolveUsernamesToUserIds(options.friendUsernames);
  return findMutualFreeSlots(viewerId, { ...options, friendUserIds });
}
```

Update `app/find-time/page.tsx`'s `handleSubmit` to call this new action (via a small wrapping server action that also injects `auth()`'s `session.user.id`, since client components cannot call `auth()` directly):

Create `app/find-time/find-slots-action.ts`:
```typescript
"use server";

import { auth } from "@/lib/auth";
import { findMutualFreeSlotsByUsername } from "./actions";

export async function findSlotsForCurrentUser(
  friendUsernames: string[],
  durationMinutes: number,
) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  return findMutualFreeSlotsByUsername(session.user.id, {
    friendUsernames,
    start: now,
    end: twoWeeksOut,
    durationMinutes,
  });
}
```

Update `app/find-time/page.tsx`'s `handleSubmit`:
```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const usernames = friendUsernames.split(",").map((s) => s.trim()).filter(Boolean);
    const result = await findSlotsForCurrentUser(usernames, duration);
    setSlots(result);
  }
```

Add the import at the top of `app/find-time/page.tsx`:
```typescript
import { findSlotsForCurrentUser } from "./find-slots-action";
```

- [ ] **Step 7: Manually verify**

With two friended test accounts sharing calendars with some events this week, visit `/find-time`, enter the friend's username and a duration, submit, and confirm the returned slots correctly avoid both people's busy times.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add free-slot finder UI"
```

---

## Phase 6: Deployment, Design Polish, and Final Verification

### Task 18: Reconnect-Google banner for expired/revoked tokens

**Files:**
- Modify: `db/schema.ts` (add `needsReconnect` to `users`), `lib/sync.ts` (set the flag on auth failure), `app/calendars/actions.ts` (set the flag on auth failure), `app/layout.tsx` (render the banner)
- Create: `components/ReconnectBanner.tsx`
- Test: `tests/reconnect-flag.test.ts`

**Interfaces:**
- Consumes: `getAccessTokenForCalendarOwner`-style Google API call sites in `lib/sync.ts` (Task 9).
- Produces: `markNeedsReconnect(userId: string): Promise<void>` and `clearNeedsReconnect(userId: string): Promise<void>` from `lib/reconnect.ts`, used by `lib/sync.ts`, `app/calendars/actions.ts`, and the Google sign-in flow (to clear the flag on a fresh successful sign-in).

- [ ] **Step 1: Add the `needs_reconnect` column**

Modify `db/schema.ts`'s `users` table definition, adding a field:
```typescript
  needsReconnect: boolean("needs_reconnect").default(false).notNull(),
```

Run:
```bash
npm run db:generate
npm run db:migrate
```

- [ ] **Step 2: Write the failing test**

Create `tests/reconnect-flag.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const updateSetMock = vi.fn(() => ({ where: vi.fn(async () => {}) }));
const updateMock = vi.fn(() => ({ set: updateSetMock }));

vi.mock("@/db/client", () => ({ db: { update: updateMock } }));

import { markNeedsReconnect, clearNeedsReconnect } from "@/lib/reconnect";

describe("reconnect flag helpers", () => {
  beforeEach(() => {
    updateMock.mockClear();
    updateSetMock.mockClear();
  });

  it("markNeedsReconnect sets needsReconnect to true", async () => {
    await markNeedsReconnect("user-1");
    expect(updateSetMock).toHaveBeenCalledWith({ needsReconnect: true });
  });

  it("clearNeedsReconnect sets needsReconnect to false", async () => {
    await clearNeedsReconnect("user-1");
    expect(updateSetMock).toHaveBeenCalledWith({ needsReconnect: false });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/reconnect-flag.test.ts`
Expected: FAIL — `Cannot find module '@/lib/reconnect'`.

- [ ] **Step 4: Implement `lib/reconnect.ts`**

Create `lib/reconnect.ts`:
```typescript
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function markNeedsReconnect(userId: string) {
  await db.update(users).set({ needsReconnect: true }).where(eq(users.id, userId));
}

export async function clearNeedsReconnect(userId: string) {
  await db.update(users).set({ needsReconnect: false }).where(eq(users.id, userId));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/reconnect-flag.test.ts`
Expected: PASS, both tests.

- [ ] **Step 6: Set the flag on Google auth failures in the sync engine**

Modify `lib/sync.ts`'s `runIncrementalSync`, changing the `catch` block:
```typescript
  } catch (err: any) {
    if (err?.code === 410) {
      await runInitialSync(calendarRowId, accessToken);
      return;
    }
    if (err?.code === 401 || err?.code === 403) {
      const { markNeedsReconnect } = await import("@/lib/reconnect");
      await markNeedsReconnect(calendarRow.userId);
      return;
    }
    throw err;
  }
```

Wrap `runInitialSync`'s Google API call similarly — modify it to catch and re-throw with the same 401/403 handling:
```typescript
export async function runInitialSync(calendarRowId: string, accessToken: string) {
  const [calendarRow] = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.id, calendarRowId));
  if (!calendarRow) throw new Error(`Unknown calendar row ${calendarRowId}`);

  try {
    const { items, nextSyncToken } = await fetchAllGoogleEvents(
      accessToken,
      calendarRow.googleCalendarId,
    );

    await upsertEventsFromGoogle(calendarRowId, items);

    await db
      .update(googleCalendars)
      .set({ syncToken: nextSyncToken, lastSyncedAt: new Date() })
      .where(eq(googleCalendars.id, calendarRowId));
  } catch (err: any) {
    if (err?.code === 401 || err?.code === 403) {
      const { markNeedsReconnect } = await import("@/lib/reconnect");
      await markNeedsReconnect(calendarRow.userId);
      return;
    }
    throw err;
  }
}
```

- [ ] **Step 7: Clear the flag on successful sign-in**

Modify `lib/auth.ts`'s `callbacks`, adding a `signIn` callback alongside the existing `session` callback:
```typescript
  callbacks: {
    async signIn({ user }) {
      if (user.id) {
        const { clearNeedsReconnect } = await import("@/lib/reconnect");
        await clearNeedsReconnect(user.id);
      }
      return true;
    },
    async session({ session, user }) {
      // ...unchanged from Task 7 Step 7...
    },
  },
```

- [ ] **Step 8: Build and render the banner**

Create `components/ReconnectBanner.tsx`:
```tsx
import { signIn } from "@/lib/auth";

export function ReconnectBanner() {
  return (
    <div className="flex items-center justify-between bg-amber-100 px-4 py-2 text-sm text-amber-900">
      <span>Your Google Calendar connection has expired.</span>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button type="submit" className="font-medium underline">
          Reconnect
        </button>
      </form>
    </div>
  );
}
```

Modify `app/layout.tsx` to conditionally render it:
```tsx
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ReconnectBanner } from "@/components/ReconnectBanner";
import "./globals.css";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  let needsReconnect = false;
  if (session?.user?.id) {
    const [row] = await db.select().from(users).where(eq(users.id, session.user.id));
    needsReconnect = row?.needsReconnect ?? false;
  }

  return (
    <html lang="en">
      <body>
        {needsReconnect && <ReconnectBanner />}
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Manually verify**

Revoke this app's access from the Google Account permissions page (myaccount.google.com/permissions) for a test account, then trigger a sync for that account (e.g. via the reconciliation cron or by visiting `/calendars`), and confirm the banner appears; click "Reconnect", complete the OAuth flow again, and confirm the banner disappears.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: show a reconnect banner when a Google token is expired or revoked"
```

---

### Task 19: Vercel deployment configuration

**Files:**
- Modify: `vercel.json` (already has cron config from Task 10), `.env.example`
- Create: `docs/superpowers/plans/deployment-checklist.md` (tracking doc, not code)

**Interfaces:** none (infrastructure task).

- [ ] **Step 1: Create the Vercel project and link it**

Using the Vercel MCP tools, create a new Vercel project linked to this repository (or connect the existing local repo if the user has already pushed it to GitHub — ask the user for their GitHub remote if one doesn't exist yet, since Vercel deployment from Git requires a remote).

- [ ] **Step 2: Set all required environment variables in Vercel**

Using the Vercel MCP tools, set each of the following as Vercel project environment variables (Production and Preview), sourcing real values from `.env.local` and the Supabase/Google Cloud Console setup done in earlier tasks: `DATABASE_URL`, `DIRECT_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `APP_URL` (set to the real production URL, e.g. `https://your-app.vercel.app`), `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

- [ ] **Step 3: Add the production redirect URI to the Google OAuth client**

In Google Cloud Console, add `https://<production-domain>/api/auth/callback/google` as an authorized redirect URI on the same OAuth client used in Task 3 (Google OAuth clients support multiple redirect URIs, so localhost can remain for local dev).

- [ ] **Step 4: Deploy and verify**

Using the Vercel MCP tools, trigger a deployment. Once live, verify: `/login` loads, Google sign-in redirects correctly to the production callback URL, and a `GET` to `/api/cron/reconcile-sync` with the correct `Authorization: Bearer $CRON_SECRET` header returns `200`.

- [ ] **Step 5: Commit any config changes**

```bash
git add -A
git commit -m "chore: finalize Vercel deployment configuration"
```

---

### Task 20: Design/polish pass with Impeccable

**Files:** whichever page/component files the Impeccable tool's review identifies (expected candidates: `app/login/page.tsx`, `app/onboarding/page.tsx`, `app/calendars/page.tsx`, `app/friends/page.tsx`, `app/page.tsx`, `components/CalendarGrid.tsx`, `app/find-time/page.tsx`).

**Interfaces:** none (visual/UX refinement of already-working flows; no behavior changes to any function signature produced by earlier tasks).

- [ ] **Step 1: Run the app locally and view each flow**

Run `npm run dev`, walk through: login → onboarding → calendars → friends → merged view (home) → find-time.

- [ ] **Step 2: Invoke the Impeccable skill for each flow**

For each page above, invoke the `impeccable` skill against that page's current implementation, asking it to critique and polish typography, spacing, color, hierarchy, empty states (e.g. "no friends yet", "no shared calendars yet", "no free slots found"), and error states (e.g. failed friend request, expired Google token banner), while preserving every existing `data-*`/id hook and not changing any server action's signature.

- [ ] **Step 3: Apply the suggested changes incrementally, re-running tests after each file**

After each file Impeccable modifies, run `npm test` to confirm no test broke (tests assert on function contracts and data, not markup, so this should be safe, but verify).

- [ ] **Step 4: Manually re-verify each flow still functions**

Repeat Step 1's walkthrough after polish to confirm no behavior regressed (forms still submit, toggles still work, redirects still fire).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "polish: apply Impeccable design pass across all user-facing flows"
```

---

### Task 21: Manual end-to-end verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Two-account webhook propagation test**

Using two real Google accounts (e.g. your own and a friend's, or two test accounts) against the deployed app: both sign in, pick usernames, each shares at least one calendar, they friend each other and accept. Confirm each sees the other's shared calendar in the merged view.

- [ ] **Step 2: Real-time propagation test**

With the merged view open in a browser tab, create a new event directly in one friend's real Google Calendar. Confirm the new event appears in the other friend's open merged-view tab within roughly a few seconds to a minute (webhook-driven), without a manual page refresh.

- [ ] **Step 3: Reconciliation fallback test**

Temporarily delete that calendar's row in `watch_channels` via the Supabase MCP `execute_sql` tool (simulating a dropped webhook channel) without deleting the underlying Google watch — then edit an event in Google Calendar again. Confirm the change does *not* show up immediately (webhook has no channel to deliver to), but does show up in the merged view within an hour once the reconciliation sweep cron runs (or trigger it manually via the Vercel MCP tools / a direct authenticated request to `/api/cron/reconcile-sync` to verify without waiting).

- [ ] **Step 4: Per-viewer toggle test**

Confirm that hiding a friend on the merged view removes their events from your view but does not affect what that friend sees of your calendar, and does not remove the underlying friendship or sharing.

- [ ] **Step 5: Free-slot finder correctness test**

With both accounts having distinct busy blocks this week, use `/find-time` to search for a 30-minute mutual slot and manually confirm the returned slots don't overlap either person's real events.

- [ ] **Step 6: Record results**

Document pass/fail for each step above in a short note to the user (no file needed unless issues are found — if any step fails, file it as a bug and fix before considering the project done).

---

