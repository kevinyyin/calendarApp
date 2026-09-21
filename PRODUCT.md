# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The app's own developer/owner and a small circle of friends they invite. Not a commercial product with unknown or general-public users — a personal tool used by people who already know and trust each other.

## Product Purpose

Overlap lets a signed-in user connect their Google Calendar, choose which of their own calendars to share, and see a merged weekly view combining their own events with friends' shared calendars, so a small group of friends can see each other's availability without manually comparing calendars. It also finds a mutual free time slot across a chosen group of friends within the next two weeks.

## Positioning

The mechanism a neighboring generic calendar/scheduling tool wouldn't have: a friends-only (accepted-friendship-gated) merged calendar view plus a mutual free-time finder, built directly on each person's own Google Calendar rather than a separate shared-calendar object. No public directory, no organization/workspace concept — visibility is strictly peer-to-peer and opt-in per calendar.

## Operating Context

Used casually, likely a few times a week, by someone checking "what does my week with my friends look like" or "when can the four of us actually meet." Not a work tool inside a company; no admin roles, no billing, no onboarding funnel beyond Google sign-in and picking a username.

## Capabilities and Constraints

- Auth: Google OAuth via NextAuth (database session strategy).
- Data: users, friendships (request/accept/decline/cancel/remove), Google-calendar metadata plus a cached copy of events (synced via the Google Calendar API, push channels, and a cron reconciliation sweep), and merged-view visibility preferences.
- Sharing is per-calendar and all-current-and-future-friends (no per-friend granularity) — a known, accepted product constraint, not a bug.
- Responsive web only; no native mobile app.

## Brand Commitments

- Name: "Overlap" — confirmed to stay through this redesign.
- No existing logo mark beyond a text wordmark.
- Auto light/dark theming (OS-driven, no manual toggle) is an existing implementation detail, not a confirmed requirement — open for the redesign to keep or replace.
- **Standing visual direction (user-pinned, 2026-09-21):** the user named Apple's marketing aesthetic — typography scale, generous whitespace, restraint, motion quality — adapted for Overlap's Operate-mode task screens (not literal hero-imagery/scroll-marketing sections on functional pages), plus Things 3 / Fantastical as the calibration for warmth and tactility so the result reads "premium and spa-like," not cold/clinical. This is a brief-pinned canon reference per the design skill's standing-exit path — it stands until the user changes it, and future visual work on this app should sit alongside these two references rather than re-opening a direction round.
- **Standing palette (user-pinned, 2026-09-21, supersedes the original warm-ivory/pine-teal palette from the same day):** a user-supplied "Stormy morning" blue-gray board (`#6A89A7` / `#BDDDFC` / `#88BDF2` / `#384959`) — see DESIGN.md's Colors section for the full role mapping and contrast notes. The "premium and spa-like, not cold/clinical" quality above is now carried by materials, motion, and generous whitespace rather than warm hue — the palette itself is intentionally cool.

## Evidence on Hand

No marketing assets, testimonials, screenshots, or case studies exist, and none should be fabricated. This is a live, functioning app with real (if small-scale) usage — content in the UI is the user's real data (their calendars, their friends), never sample or lorem content.

## Product Principles

- Trust-and-consent first: every visibility change (sharing a calendar, accepting a friend request, unfriending) is an explicit, confirmable action between people who already know each other — the redesign must not make these feel casual or accidental.
- Small, personal scale: design for a handful of friends checking a shared week, not a dashboard for managing hundreds of contacts or calendars.
- Operate mode throughout the authenticated app (task completion: connect, share, browse, schedule) — the ambition is a premium *aesthetic* (typography, spacing, motion, materials), not a shift toward marketing/persuasion content on the task screens themselves. `/login` is the one screen closer to a first impression.
- Real Google Calendar data drives every view — no placeholder state should look more "finished" than the real one; empty/error/loading states matter as much as the populated ones.

## Accessibility & Inclusion

No project-specific requirement beyond ordinary web accessibility. The existing implementation already uses semantic labels, `aria-*` attributes, and a visible focus-ring token — the redesign must preserve or improve on this, not regress it for visual polish.
