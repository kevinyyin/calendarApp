# Friend Calendar Sync — Design Spec

Date: 2026-09-18
Status: Approved, ready for implementation planning

## Summary

A small, private web app for a fixed group of friends to connect their
Google Calendars, share them with each other, see a merged view of
everyone's schedule, and find mutual free time. Calendar data updates
near-real-time when a friend changes their Google Calendar.

## Goals

- Google sign-in with per-user calendar selection (choose which of your
  Google calendars to share, e.g. exclude "Personal" but share "Work").
- Symmetric friend relationships (friend request / accept), no per-friend
  ACL beyond that.
- Friends see each other's shared calendars with full event details
  (title, time, location, description).
- Merged calendar view, with a per-viewer toggle to show/hide each
  friend's events without affecting the underlying sharing relationship.
- A free-slot finder: pick a group of friends + date range + duration,
  get back times when everyone is free.
- Near-real-time propagation of changes made in a friend's actual Google
  Calendar.
- Usernames as the friendly identifier used across the UI (search,
  friend requests, display), distinct from Google account email/name.

## Non-goals

- Open/public sign-up — this is built for a small, known friend group.
- Writing to anyone's Google Calendar (read-only integration).
- Per-friend granular sharing permissions beyond the calendar-level
  `is_shared` toggle and the symmetric friendship model.
- Support for calendar providers other than Google.

## Architecture Overview

- **Framework:** Next.js (App Router), TypeScript, deployed on Vercel.
- **Auth:** Auth.js (NextAuth v5), Google provider, using a Postgres
  database adapter (Supabase) so OAuth accounts/tokens and sessions are
  persisted server-side rather than JWT-only.
- **Database:** Supabase Postgres, also used for Supabase Realtime
  (Postgres change subscriptions) to push live updates to connected
  browser clients.
- **Background jobs:** Vercel Cron for (a) nightly Google watch-channel
  renewal and (b) hourly reconciliation sync sweep.
- **External API:** Google Calendar API, `calendar.readonly` scope only
  (this app never modifies a user's real Google Calendar).
- **UI polish:** built with React + Tailwind for structure and real
  data first, then passed through the Impeccable tool for a design
  critique/polish pass (typography, spacing, motion, empty/error
  states) before shipping each flow.

### High-level flow

1. User signs in with Google via Auth.js.
2. User picks a username (onboarding, one-time).
3. User's Google calendars are listed (`calendarList.list`); user
   toggles which ones to share.
4. Toggling a calendar on triggers an initial full sync into our local
   `events` cache and registers a Google push notification
   (`watch()`) channel on that calendar, pointed at our webhook.
5. Google pings our webhook on changes; we pull the delta via
   `events.list` with a stored sync token and upsert into `events`.
6. Friends' UIs read exclusively from the local `events` cache (never
   hitting Google's API on page load) and receive live pushes via
   Supabase Realtime when relevant rows change.
7. Users send/accept friend requests; once accepted, each can see the
   other's shared calendars in the merged view, with a personal
   show/hide toggle per friend.
8. The free-slot finder computes gaps in the merged busy time across a
   chosen group, from the same local cache.

## Data Model

Tables in Supabase Postgres. Auth.js manages `users`/`accounts`/
`sessions`/`verification_tokens` via its standard adapter schema;
extended where noted.

- **`users`** (Auth.js-managed, extended)
  - `id`, `email`, `name`, `avatar_url`, `created_at`
  - `username` — unique, chosen at onboarding, used for search/display
    everywhere in the UI in place of raw email.

- **`accounts`** (Auth.js-managed) — one row per linked Google account.
  - Stores `refresh_token` and `access_token`, **encrypted at rest**
    (AES-256-GCM, app-level encryption before write, using a key from
    `TOKEN_ENCRYPTION_KEY`). Auth.js's session/token callbacks handle
    refreshing expired access tokens using the refresh token.

- **`google_calendars`**
  - `id`, `user_id` (FK), `google_calendar_id`, `display_name`,
    `color`, `is_shared` (bool), `sync_token`, `last_synced_at`.

- **`watch_channels`**
  - `id`, `google_calendar_id` (FK), `channel_id`, `resource_id`,
    `expires_at`. One row per active Google push subscription.

- **`events`** — local cache of shared calendars' events; this is what
  every read (merged view, slot finder) queries against.
  - `id`, `google_calendar_id` (FK), `google_event_id`, `title`,
    `description`, `location`, `start_at`, `end_at`, `is_all_day`,
    `status` (confirmed/cancelled), `updated_at`.

- **`friendships`**
  - `requester_id`, `recipient_id`, `status` (pending/accepted),
    `created_at`, `responded_at`. Once accepted, the relationship is
    treated as bidirectional — no separate visibility flag per
    direction.

- **`merged_view_prefs`**
  - `viewer_id`, `friend_id`, `is_visible` (bool, default `true`),
    `updated_at`. Purely a per-viewer display preference for the
    merged calendar view; does not affect sharing/friendship or what
    the friend can see of you.

Visibility rule: a calendar is visible to a friend if and only if it
belongs to someone with an `accepted` friendship with the viewer AND
`is_shared = true` on that calendar AND (no `merged_view_prefs` row, or
`is_visible = true`) for that viewer/friend pair.

## Auth & Token Security

- OAuth scopes requested: `openid email profile
  https://www.googleapis.com/auth/calendar.readonly`.
- Refresh and access tokens are encrypted (AES-256-GCM) before being
  persisted to `accounts`, decrypted only in server-side process
  memory when calling Google's API (webhook handler, cron jobs, API
  routes). Never sent to the browser.
- Access-token refresh happens automatically via Auth.js's token
  callback using the stored (decrypted) refresh token; the new access
  token is re-encrypted and persisted.
- Read-only scope limits blast radius: this app can never alter or
  delete anything in a user's actual Google Calendar.
- Expired/revoked Google grants surface as a "reconnect your Google
  account" banner rather than failing silently.

## Calendar Sync Engine

- **Initial sync:** on sharing a calendar, full `events.list` (paginated)
  populates `events`, capturing the returned `nextSyncToken`.
- **Webhook-driven incremental sync:** Google's push notification
  carries only channel/resource identifiers, no payload. On receipt,
  look up the `watch_channels` row, run `events.list` with the stored
  sync token, upsert changed/cancelled events, store the new token.
- **Reconciliation sweep (hourly cron):** re-runs the same
  incremental-sync-by-token logic for every calendar with
  `is_shared = true`, regardless of webhook activity — a safety net so
  a dropped/missed webhook self-heals within an hour rather than going
  stale indefinitely.
- **Channel renewal (daily cron):** renews any `watch_channels` row
  expiring within 24h (Google channels expire ~7 days).
- **Sync token invalidation:** on a 410 response, fall back to a full
  re-sync for that calendar and mint a fresh token.

## Friends & Sharing

- Friend request by username or email search → `friendships` row
  (`pending`) → recipient accepts/declines → on accept, relationship
  is immediately bidirectional.
- Once friends, each sees every calendar the other has `is_shared`,
  with full event details, subject to that viewer's own
  `merged_view_prefs` toggle.

## Merged View & Free-Slot Finder

- **Merged view:** week/month grid overlaying the signed-in user's
  events with their friends' shared events, color-coded per person,
  with a legend/list to toggle each friend's events on/off
  (`merged_view_prefs`).
- **Free-slot finder:** given a chosen set of friends, a date range,
  and a desired duration, query all events for those people's shared
  (and currently relevant — sharing, not the display toggle, gates
  this) calendars in range, union each person's busy intervals, and
  report gaps where everyone is simultaneously free for at least the
  requested duration, constrained to a configurable waking-hours
  window (default 8am–10pm, viewer's local time).

## Real-Time UI Updates

- Browser clients subscribe via Supabase Realtime to Postgres changes
  on `events` rows for calendars belonging to the signed-in user's
  friends. When the sync engine upserts a row, subscribed clients
  receive the change and update the merged view without a manual
  refresh.

## Design & Polish Approach

Each flow is first built as a plain, functional React + Tailwind
implementation with real data and no placeholder content. Once a flow
works end-to-end, it goes through the Impeccable tool for a design
critique/polish pass — typography, spacing, color, motion, and
empty/error states — so the shipped UI avoids generic AI-generated
patterns.

## Testing & Error Handling

- **Unit tests:** slot-finder gap computation (back-to-back events,
  all-day events, overlaps, empty calendars), token
  encryption/decryption round-trip.
- **Integration tests:** webhook handler against mocked Google
  payloads (new/cancelled event, 410 fallback), reconciliation sweep
  idempotency (re-sync doesn't duplicate events).
- **Manual verification:** two real Google test accounts, friend each
  other, share a calendar, confirm an edit in Google Calendar
  propagates through webhook → cache → merged view within seconds, and
  that the reconciliation sweep catches a change with the webhook
  deliberately blocked.
- **Failure handling:** expired/revoked tokens show a reconnect
  banner; webhook requests are validated by channel ID before being
  trusted.

## Open Items for Implementation Planning

None outstanding — all major decisions (scale, stack, visibility
level, sync freshness mechanism, sharing model, calendar scope,
database choice, username, per-viewer toggle) were resolved during
brainstorming and are reflected above.
