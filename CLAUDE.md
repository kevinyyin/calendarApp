# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Before writing any code

This repo runs a pinned Next.js version that has breaking changes vs. training data (e.g. `middleware.ts` is deprecated in favor of `proxy.ts`, which defaults to the Node.js runtime instead of Edge). Read the relevant guide under `node_modules/next/dist/docs/` before touching routing, middleware/proxy, or other framework-level conventions — see `AGENTS.md` for why.

## Commands

```bash
npm run dev              # next dev
npm run build            # next build
npm run lint             # eslint
npm test                 # vitest run (all tests)
npx vitest run tests/foo.test.ts   # single test file
npx vitest tests/foo.test.ts       # watch mode for one file
npm run db:generate       # drizzle-kit generate — after editing db/schema.ts
npm run db:migrate        # drizzle-kit migrate — applies db/migrations/*.sql
```

`drizzle.config.ts` loads `.env.local` itself and migrates via `DIRECT_URL` (non-pooled connection required for DDL). Runtime code (`db/client.ts`) connects via `DATABASE_URL` (pgbouncer/pooled) — don't conflate the two.

## Architecture

This is a Next.js App Router app that lets Google-Calendar users share busy/free visibility with accepted friends and find overlapping open time. Three data stores are in play and each has a distinct role:

- **Postgres via Drizzle** (`db/schema.ts`, `db/client.ts`) — source of truth for users, NextAuth accounts/sessions, friendships, calendar metadata, and cached `events` rows. Accessed almost exclusively from server code (Server Components, Server Actions, route handlers).
- **Supabase** — same Postgres database, but also used for two things Drizzle doesn't touch: Row Level Security policies (`db/migrations/0008_supabase_events_rls.sql`) that gate direct client reads of `events`, and Realtime (`components/RealtimeMergedView.tsx`, `lib/supabase-client.ts`) so a friend's calendar change appears live without a page reload.
- **Google Calendar API** — the actual event data, pulled in via `lib/google-calendar.ts` / `lib/google-calendar-events.ts` and mirrored into the `events` table by the sync pipeline below.

### Auth (`lib/auth.ts`, `lib/auth-config.ts`, `lib/auth-adapter.ts`)

NextAuth v5 (beta) with the Drizzle adapter and **database session strategy** (not JWT) — every authenticated request does a `sessions` ⋈ `users` query, which is why `proxy.ts` (the route guard, matched against nearly every path) is on the critical path for every navigation and must run in a runtime that can actually reach Postgres.

Two encryption/derivation layers wrap the adapter:
- `withEncryptedTokens` (`lib/auth-adapter.ts`) encrypts Google OAuth tokens (`lib/crypto.ts`) before they hit the `accounts` table, and `decryptAccountTokens` reverses it on read.
- The `session` callback in `lib/auth.ts` mints a separate short-lived Supabase Realtime JWT (`lib/supabase-realtime-token.ts`) per session — this is intentionally the *only* token attached to `Session`, because Auth.js returns that object verbatim from `GET /api/auth/session` to client JS. The Google access token is deliberately kept server-only.

**Auth.js only writes `accounts.access_token`/`refresh_token` on a user's first sign-in** — it does not update them on subsequent logins. Any code needing a valid Google token must call `getFreshAccessToken(userId)` (`lib/google-token.ts`), which checks expiry and refreshes against Google if needed, rather than reading `accounts.access_token` directly. A dead/revoked grant surfaces as `GoogleReconnectRequiredError` and flips `users.needs_reconnect` (`lib/reconnect.ts`), which `components/ReconnectBanner.tsx` reads to prompt re-auth — this path must fail soft (no throw/crash) everywhere it's checked, since it's expected to happen in normal use (token revocation, expiry).

### Calendar sync (`lib/sync.ts`, `lib/google-watch.ts`)

`events` is a cache of Google Calendar data, kept fresh three ways:
- `runInitialSync` — full fetch, used when a calendar is first connected/shared.
- `runIncrementalSync` — uses the calendar's stored `syncToken`; on Google's `410 Gone` (expired token) it transparently falls back to `runInitialSync`.
- Google push notifications hit `app/api/webhooks/google-calendar/route.ts`, which looks up the `watch_channels` row by `x-goog-channel-id` and triggers an incremental sync.

Two Vercel crons (`vercel.json`, secured by a `CRON_SECRET` bearer check) backstop this: `renew-channels` renews watch channels expiring within 24h, `reconcile-sync` sweeps all shared calendars incrementally as a catch-all for missed webhooks. Both isolate per-item failures (one bad calendar/channel must not abort the whole run) and treat a dead Google grant as a skip, not an error.

### Visibility & merged view (`lib/visibility.ts`, `lib/merged-view.ts`, `lib/friendships.ts`)

A calendar is visible to a friend only if `google_calendars.is_shared` is true **and** the two users have an `accepted` friendship row. `merged_view_prefs` layers a per-viewer, per-friend "hide" toggle on top of that — it only ever hides a *friend's* calendars from the viewer, never the viewer's own. `getMergedViewEvents` intersects (not contains) the requested range against event start/end, so multi-day and boundary-crossing events aren't dropped.

`lib/free-slots.ts` (`findFreeSlots`) is pure and unit-tested in isolation: given busy intervals across people plus a waking-hours band and the viewer's timezone offset, it returns open slots. Keep it framework-free.

### Path alias

`@/*` maps to the repo root (see `tsconfig.json`); use it instead of relative imports across directories.
