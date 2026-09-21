---
target: the whole web app
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-21T03-48-30Z
slug: the-whole-web-app
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | SubmitButton's pending states are excellent everywhere, but the realtime merged view has no "connecting/synced" indicator if the Supabase channel silently fails |
| 2 | Match System / Real World | 3/4 | Plain, logical copy, but "waking hours" clipping in Find-a-time is never explained in the UI |
| 3 | User Control and Freedom | 2/4 | No way to remove/unfriend anyone anywhere in the app -- a relationship, once accepted, is permanent |
| 4 | Consistency and Standards | 4/4 | Empty-state and card patterns are reused identically across every page |
| 5 | Error Prevention | 2/4 | Unsharing a calendar -- a privacy-affecting action -- fires with zero confirmation |
| 6 | Recognition Rather Than Recall | 2/4 | Adding a friend and finding a time both require typing an exact username from memory, no directory or autocomplete |
| 7 | Flexibility and Efficiency | 1/4 | No bulk actions, no saved friend groups, no picker -- every Find-a-time search re-types the same list |
| 8 | Aesthetic and Minimalist Design | 3/4 | Clean and uncluttered, but the sparseness tips into flatness |
| 9 | Error Recovery | 2/4 | Field-level errors are handled well, but toggle actions have no local error handling -- a thrown server action wipes the whole page via error.tsx instead of failing inline |
| 10 | Help and Documentation | 1/4 | Genuinely non-obvious mechanics (waking-hours window, all-or-every-friend sharing) get zero explanation anywhere |
| **Total** | | **23/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** This reads as a disciplined, well-engineered generic CRUD panel wearing a friends-calendar label, not a product authored around "two friends coordinating schedules." Friends render as bare `<li>{username}</li>` text rows with no avatar or warmth. The entire payoff screen -- Find-a-time's results -- is a plain bordered list styled identically to every other list in the app. One real flourish exists (the pill-shaped Show/Hide toggles), but everything else is textbook Tailwind indigo-on-slate.

**Deterministic scan:** detect.mjs ran clean against app/ and components/ -- 0 findings. Useful contrast: the mechanical pattern-scanner has nothing to flag, but the LLM review's genericness finding is at a deeper, structural level a pattern-detector can't see.

**Visual overlays:** No overlay is available. Injection was attempted honestly: DOM mutation was verified working, and a control test confirmed general cross-origin script loading works, but the localhost detect.js request was blocked with net::ERR_BLOCKED_BY_CLIENT, consistent with the sandboxed browser pane firewalling loopback addresses rather than any defect in the app.

## Overall Impression

The engineering discipline is genuinely good -- the SubmitButton/empty-state/form-accessibility patterns are more consistent than most apps at this stage manage, and the auth gate correctly redirects every unauthenticated route (verified live: /, /friends, /calendars all land on /login, no flash of protected content, no console or network errors). But the app stops at "functionally correct," short of "feels made for this." The single biggest opportunity: the app already has the data to remove its two biggest friction points (typing usernames from memory) but doesn't use it anywhere.

## What's Working

1. SubmitButton's pending-state discipline -- one component, reused on every server-action form in the app, each with contextual pending text.
2. The empty-state pattern (border-dashed rounded-lg p-8 text-center) -- reused verbatim across five different pages/components.
3. Form accessibility wiring -- aria-invalid, aria-describedby, role="alert", and aria-pressed are all correctly wired throughout.

## Priority Issues

**[P1] No way to remove a friend.** The accepted-friends list is inert text with no action. A friendship -- which grants ongoing visibility into calendar data -- can't be revoked from the UI at all.
Fix: an unfriend action per row, with a lightweight confirm.
Suggested command: /impeccable shape

**[P1] Find-a-time ignores data the app already has.** The friend field is free-text you fill from memory, even though the Friends page already queries your full accepted-friends list from the same database.
Fix: a checklist of existing friends instead of a text input.
Suggested command: /impeccable shape

**[P2] Outgoing friend requests are invisible.** Only incoming requests are queried anywhere -- send one, and you get zero feedback ever again.
Fix: a "Sent requests" section with cancel.
Suggested command: /impeccable shape

**[P2] Calendar sharing is all-or-nothing with no visible audience or confirmation.** Exposes a calendar to every current and future friend equally, with no on-page statement of who sees it, and no confirmation before the toggle fires.
Fix: state the audience explicitly, add a confirm on first share.
Suggested command: /impeccable harden

**[P3] Inconsistent, imprecise date/time formatting on the two most schedule-critical screens.** Find-a-time and the merged view both mix full-date-plus-seconds formatting for the start with time-only for the end, default locale, no timezone label.
Fix: one shared Intl.DateTimeFormat helper, hour/minute only, with a timezone abbreviation.
Suggested command: /impeccable polish

## Persona Red Flags

**Alex (Power User):** No saved/frequent friend groups for Find-a-time. No bulk share/unshare for someone with 10+ Google calendars. No keyboard-driven path anywhere.

**Jordan (First-Timer):** Onboarding redirects straight home after setting a username with no mention that calendars must be separately shared on /calendars first. A first-time user with no friends yet sees only a small "Add a friend" box with no nudge toward Calendars.

**Casey (Mobile):** NavBar packs a wordmark, 4 links, a username label, and sign-out into one row with horizontal scroll instead of a proper mobile nav. NavBar links and the home page's Hide/Show pills both fall short of the ~44px touch-target guideline. The active:scale-95 press feedback added recently is a genuinely good tactile touch for this persona though.

## Minor Observations

- Find-a-time's duration input has no upper bound.
- Calendar-color dots use Google's raw hex with no contrast check against the dark-mode background.
- No logo/mark beyond the text wordmark.
- error.tsx/global-error.tsx copy is identical and generic everywhere.
- Declining a friend request gives the decliner no confirmation -- probably correct but worth being deliberate.

## Questions to Consider

1. What if Find-a-time defaulted to searching all 24 hours and confidently suggested a 3am slot as "free" -- would anyone notice before booking it?
2. What if declining a request is indistinguishable, from the requester's side, from "never seen it" -- is silent rejection the right norm here?
3. What if calendar sharing were per-friend-per-calendar instead of all-or-nothing?
