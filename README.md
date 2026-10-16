# Overlap

See your week alongside your friends' and find a time you're all free.

Overlap is a small, friends-only web app built on Google Calendar. You sign in with Google, choose which of your calendars to share, and add friends by username. Once a friend accepts, each of you sees the other's shared calendars merged into a day/week view. The view updates live when a calendar changes. A "find time" tool searches the next two weeks for open slots that work for a group.

Visibility is opt-in per calendar and only goes to accepted friends. There's no public directory and no organizations.

## Features

- **Google sign-in.** NextAuth v5 with database sessions. OAuth tokens are encrypted at rest (AES-256-GCM).
- **Friends.** Send, accept, decline, cancel and remove requests by username.
- **Per-calendar sharing.** Each Google calendar can be shared with all of your accepted friends or kept private.
- **Merged view.** A day/week grid of your events plus your friends' shared calendars. You can hide individual friends from your view.
- **Live updates.** Supabase Realtime pushes a friend's calendar changes to your page with no reload.
- **Find time.** Mutual free slots across a group, limited to waking hours and shown in your timezone.
- **Reconnect prompt.** If Google access is revoked or expires, a banner asks you to sign in again. Nothing crashes.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions, `proxy.ts`), React 19, Tailwind CSS 4
- Postgres (hosted on Supabase) with [Drizzle ORM](https://orm.drizzle.team)
- Supabase Row Level Security and Realtime
- Google Calendar API (`googleapis`), including push notifications (watch channels)
- Vitest and Testing Library
- Deployed on Vercel with Vercel Cron

## How it works

```
Google Calendar ──(initial / incremental sync)──▶ events table (Postgres)
      │                                                 │
      └──(push webhook)──▶ /api/webhooks/google-calendar │
                                                         ▼
                         Server Components ◀── visibility rules (shared + accepted friendship)
                                                         │
                         Browser ◀── Supabase Realtime (RLS-gated) ── live updates
```

- **Sync** (`lib/sync.ts`): a full sync runs when a calendar is first shared. After that, syncs are incremental and use Google's `syncToken`. When the token expires (`410 Gone`), the app falls back to a full sync.
- **Webhooks** (`app/api/webhooks/google-calendar`): Google push notifications start an incremental sync for the calendar that changed.
- **Crons** (`app/api/cron/*`, protected by `CRON_SECRET`):
  - `renew-channels` renews watch channels that expire within 24 hours.
  - `reconcile-sync` sweeps all shared calendars to catch missed webhooks.
- **Visibility** (`lib/visibility.ts`): a friend sees your calendar only when it's marked shared **and** your friendship is accepted.
- **Free slots** (`lib/free-slots.ts`): a pure function with no framework dependencies, unit-tested on its own.

Architecture notes for contributors are in [`CLAUDE.md`](CLAUDE.md).

## Getting started

### Prerequisites

- Node.js 20 or later
- A Supabase project (Postgres, Realtime, RLS)
- A Google Cloud OAuth client with the Google Calendar API enabled

### 1. Install

```bash
git clone https://github.com/kevinyyin/calendarApp.git
cd calendarApp
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Pooled (pgbouncer) Postgres URL, used at runtime |
| `DIRECT_URL` | Direct Postgres URL, used for migrations |
| `TOKEN_ENCRYPTION_KEY` | 32 random bytes, base64-encoded: `openssl rand -base64 32` |
| `AUTH_SECRET` | NextAuth secret: `npx auth secret` or `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client credentials |
| `APP_URL` | Public base URL of the app (Google push notifications go here) |
| `CRON_SECRET` | Bearer token the cron endpoints check |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Used by the browser for Realtime. Safe to expose because RLS protects the data |
| `SUPABASE_JWT_SECRET` | Supabase legacy JWT secret. Server-only; signs short-lived Realtime tokens |

In Google Cloud, add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI. Add your production URL's equivalent when you deploy.

### 3. Set up the database

```bash
npm run db:migrate
```

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000.

> Google push notifications need a public HTTPS `APP_URL`. When you run locally without a tunnel, events still sync on first share and through the reconcile cron, but you won't get live webhook updates.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Build and serve for production |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite |
| `npm run db:generate` | Generate a migration after editing `db/schema.ts` |
| `npm run db:migrate` | Apply migrations in `db/migrations/` |

## Project structure

```
app/          Routes: merged view, calendars, friends, find-time, onboarding, login, API
components/   Shared UI (calendar grid, nav, realtime view, reconnect banner)
db/           Drizzle schema, client, SQL migrations
lib/          Auth, Google Calendar, sync, visibility, free-slot logic
tests/        Vitest unit and component tests
proxy.ts      Route guard (Next.js 16 replacement for middleware)
```

## Deployment

The app is built for Vercel. Set the environment variables above in your Vercel project, then deploy. Cron schedules are in `vercel.json`. When `CRON_SECRET` is set, Vercel sends it automatically as a bearer token.
