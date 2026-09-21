---
name: Overlap
description: A calm, premium merged-calendar tool for a small circle of friends.
colors:
  background: "#f4f8fc"
  surface: "#ffffff"
  surface-muted: "#bdddfc"
  foreground: "#384959"
  muted: "#557089"
  border: "#cfe0ef"
  accent: "#384959"
  accent-foreground: "#ffffff"
  accent-muted: "#bdddfc"
  danger: "#b3452f"
  danger-muted: "#fbeee9"
  success: "#3f7a52"
  warning: "#a15c1f"
  warning-muted: "#faf0e2"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3rem, 6vw, 5.25rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 4.5vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.2em"
  tag:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0em"
rounded:
  sm: "12px"
  md: "16px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.full}"
    padding: "10px 20px"
  button-danger:
    backgroundColor: "{colors.danger-muted}"
    textColor: "{colors.danger}"
    rounded: "{rounded.full}"
    padding: "10px 20px"
  button-quiet:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.muted}"
    rounded: "{rounded.full}"
    padding: "10px 20px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "16px 20px"
  badge:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.muted}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
---

# Design System: Overlap

## Overview

**Creative North Star: "The Quiet Concierge"**

Overlap exists to take a small, mundane chore — figuring out when a handful of friends are all free — and handle it with the unhurried confidence of someone who's good at their job and never makes you feel rushed. The system refuses the generic Tailwind-indigo SaaS-dashboard default: no cold slate grays, no scattershot card grids, no kicker labels announcing what a heading already says on its own. It borrows Apple's marketing-page restraint — generous type scale, huge quiet margins, one idea per screen — but stays an Operate-mode tool throughout: nothing here exists to persuade, only to help. Things 3 and Fantastical set the calibration for warmth: this should feel tactile and considered, never clinical.

Both light and dark modes are supported (OS-driven, no manual toggle) because the app is genuinely used at any hour — a scene-based choice, not a category default.

**Key Characteristics:**
- Cool blue-gray neutrals throughout — misty white and deep navy ("Stormy morning," 2026-09-21 palette amendment)
- One confident accent (deep navy, light-mode; sky blue, dark-mode) carrying every primary action and piece of state
- One typeface, at an editorial scale — big, confident display/headline type on every page, not just `/login`
- A structured grid on wide viewports: a slim meta rail (stats, filters, account bits) beside the main content column, in place of one centered column everywhere
- Hairline-divided rows for repeated list content (events, friends, calendars, slots); soft-shadow cards reserved for standalone single panels (empty states, the username editor)
- Small pill badges for metadata — counts, status, person tags — normal-case, never confused with the tracked-uppercase wordmark treatment
- Soft dual-layer shadows for depth; no hard offset "neobrutalist" shadows anywhere
- Pill-shaped controls; rounded-corner cards; nothing sharp-edged
- One entrance moment per view (a quiet rise-and-fade), never scattered per-element animation

**2026-09-21 structure amendment:** the palette, materials, and shadow/radius system above stayed pinned exactly as shipped in the original redesign. What changed is scale and structure — bigger type, a real grid, hairline rows instead of repeated cards, and a badge component — in response to feedback that the original single-column card layout, while calm, read as generic rather than distinctive. See Typography, Layout, and Components below for the specifics.

## Colors

**2026-09-21 palette amendment ("Stormy morning"):** the original warm-ivory/pine-teal family was replaced wholesale with a user-supplied blue-gray board (`#6A89A7` / `#BDDDFC` / `#88BDF2` / `#384959`), on request, after the original warm palette had already shipped. All four anchors are used directly somewhere in the system; only the near-white/near-navy background/surface/border tints and one accessibility-driven darkening (**Slate Blue** below) are derived, since the source board didn't specify those roles. Cool and restrained: two neutrals (background, surface) that read as misty morning light rather than clinical white, one confident accent, and semantic colors (danger/success/warning) — left as-is from the previous palette, since they're already desaturated enough to sit next to a cool neutral family without clashing; revisit if a fully unified semantic set is wanted later.

### Primary
- **Deep Navy** (`#384959`, dark mode `#88bdf2`): the only accent in the system. Carries every primary action (Sign in, Save, Accept, Share), the nav's active wordmark, and links. White text on the light-mode navy hits ~9.3:1 contrast; dark-navy text on the dark-mode sky blue hits ~4.7:1.

### Neutral
- **Misty White** (`#f4f8fc`, dark mode `#141c24`): page background. A hair cool-tinted, never pure white or true black.
- **Paper White** (`#ffffff`, dark mode `#1c2733`): card/surface background, one step lighter than the page so cards read as raised paper, not a boxed panel.
- **Pale Sky** (`#bdddfc`, dark mode `#243040`): muted surface for secondary buttons, hover states, and badge/accent-muted fills — one of the four source anchors, used directly in light mode.
- **Deep Navy Text** (`#384959`, dark mode `#eaf1f8`): primary text — the same value as the light-mode accent, since the source board's darkest anchor does double duty as both. ~11:1 contrast against the page background in both themes.
- **Slate Blue** (`#557089`, dark mode `#93a9bd`): secondary/muted text — captions, helper copy, timestamps. Darkened from the source anchor `#6A89A7` specifically for text use — the raw swatch reads closer to 3.4:1 against the light background, below the 4.5:1 floor for body-sized text; `#557089` clears ~4.8:1.
- **Sky Border** (`#cfe0ef`, dark mode `#2f3d4d`): the only border color in the system.

### Named Rules
**The One Accent Rule.** Deep Navy (light) / Sky Blue (dark) is the only saturated color in the interface. Danger, success, and warning exist for semantic state only and stay desaturated relative to it — never a clashing pure red/green/amber pulled from a generic palette.

## Typography

**Display/Body Font:** Plus Jakarta Sans (with `ui-sans-serif, system-ui, sans-serif` fallback)

**Character:** One humanist sans-serif throughout, at a generous scale, weighted 600 for anything that needs to lead and 400 for everything that supports it. No serif, no mono, no second family — restraint is the point.

### Hierarchy
- **Display** (600, `clamp(3rem, 6vw, 5.25rem)`, 1.02 line-height, -0.03em tracking — Tailwind utility `text-display`): the hero headline on `/` and `/login` ("See when everyone's actually free", "See when you're both free"). Raised from the original `clamp(2.25rem, 5vw, 3rem)` — the original scale under-committed to "big type" as a structural device, not just a hero flourish.
- **Headline** (600, `clamp(2.25rem, 4.5vw, 3.5rem)`, 1.05 line-height, -0.025em tracking — Tailwind utility `text-headline`): every authenticated page's `<h1>` ("This week", "Friends", "Your Google calendars", "Find a time", "Welcome"). Also raised from a flat 1.875rem — these headings now carry real editorial weight instead of reading as a form-section label.
- **Body** (400, 1rem, 1.6 line-height): supporting copy, form helper text.
- **Label** (600, 0.75rem, 0.2em tracking, uppercase): reserved for exactly one use — the "Overlap" wordmark — never repeated as a decorative kicker above other headings.
- **Tag** (500, 0.75rem, normal tracking, normal case — Tailwind utility `text-tag`): the `Badge` component's label style. Deliberately NOT tracked/uppercase like Label, so a metadata pill (a count, a status, a person's name) can never be mistaken for the banned kicker pattern.

### Named Rules
**The No-Kicker Rule.** No small tracked label ever sits directly above a heading as a category/eyebrow tag. The wordmark lives in its own corner position instead — a lesson learned mid-build, when the wordmark-above-headline treatment on `/login` turned out to be the banned kicker pattern in different clothes. Badges (Tag style) are exempt by construction: they sit beside or below headings as real content metadata, in a visually distinct normal-case style, never mimicking Label's tracked uppercase.

## Layout

Two patterns, chosen by content shape:

- **Centered single column** — `/login`, `/onboarding`, and the signed-out `/` hero: one focused action, generous surrounding whitespace, `max-w-sm`.
- **Meta rail + content grid** — every authenticated page (`/`, `/friends`; `max-w-5xl`): a `grid-cols-1 lg:grid-cols-[200px_1fr] lg:gap-16` layout puts a slim meta rail (quick stats, filters, the username editor) on the left at desktop widths, with the main content list on the right. Below `lg`, the rail collapses above the content as a normal block — never a second card, never hidden. `/calendars` and `/find-time` use the same big-headline-and-badges header treatment without a rail (their content is a single list or form, not two distinct groupings).

Generous vertical rhythm throughout: pages open with `py-16`–`py-20`, major sections separate with `mb-10`–`mb-16`, and more space sits above a heading than below it. The public `/` landing page runs wider (`max-w-6xl`) with an asymmetric hero grid (`lg:grid-cols-12`: a 7-column headline block beside a 5-column column of hairline-divided product facts) and a hairline-divided three-across "how it works" band in place of the original offset shadow-card row — flat, bordered rows read as structured content; three same-size floating cards read as a generic feature-grid template.

## Elevation & Depth

Soft, layered shadows — never a flat, borderless system and never a hard offset block shadow. Depth increases on hover/interaction rather than being static, which is the system's one ambient motion cue beyond the page-load rise-in.

### Shadow Vocabulary
- **Soft** (`0 1px 2px rgba(33,29,25,0.04), 0 8px 24px -12px rgba(33,29,25,0.12)`; dark mode raises the alpha, keeps the values): resting elevation for every card, calendar row, and friend-list item.
- **Lifted** (`0 2px 4px rgba(33,29,25,0.05), 0 16px 40px -16px rgba(33,29,25,0.22)`): hover state for cards and the primary sign-in button — depth grows toward the user rather than the page just changing color.

### Named Rules
**The Grows-On-Touch Rule.** A resting surface uses Soft; the same surface under hover/focus uses Lifted. Depth is a response to attention, not a static decoration.

## Shapes

Two radius steps only: `12px` (`rounded-xl`) for cards, inputs, and grouped panels; fully pill (`9999px`) for every button and chip. Nothing in the system uses a sharp corner or an intermediate `rounded-md`/`rounded-lg` step — the two-step scale is deliberate, not an oversight.

## Components

### Buttons
- **Shape:** fully pill (`rounded-full`), always.
- **Primary:** Deep Navy background, white text, `px-5 py-2.5`–`py-3` depending on context, Soft shadow at rest, Lifted on hover, `active:scale-[0.98]` on press with the exponential-ease-out timing token (`cubic-bezier(0.16, 1, 0.3, 1)`, 200–300ms).
- **Danger:** Danger-Muted background with Danger text (never a filled saturated red) — used for Decline, Remove, Unshare. Deliberately quieter than Primary so a destructive action doesn't visually shout louder than the page's one accent.
- **Quiet:** Pale Sky background with Slate Blue text — used for Cancel and other low-stakes secondary actions.
- **Pending state:** every button routes through `SubmitButton` (`useFormStatus`), which swaps the label for a spinner + contextual verb ("Saving…", "Sharing…") and disables itself — this is the system's Visibility-of-status backbone, not a per-button reimplementation.

### Cards / Containers
- **Corner Style:** 12px (`rounded-xl`) for compact rows, 16px (`rounded-2xl`) for page-level cards (the username editor, empty states).
- **Background:** Paper White (Surface).
- **Shadow Strategy:** Soft at rest, Lifted on hover — see Elevation & Depth.
- **Border:** Sky Border, 1px, always present even where a shadow also exists — the two are not redundant, the border keeps the edge crisp at small sizes where the shadow is barely visible.
- **Internal Padding:** `p-4`–`p-6` depending on density; empty states use `p-10` for breathing room.
- **When to use a card at all:** only for a standalone single panel — an empty state, the username editor, a dashed "nothing here" placeholder. A *repeated* list of same-shape items (events, friends, calendars, free-time slots) never uses one shadow card per row; see List Rows below. Repeated same-size cards standing in for structure is exactly the generic pattern this amendment moved away from.

### List Rows
Repeated list content — merged-view events, friend requests, friends, shared calendars, free-time slots — renders as a flat list with `divide-y divide-border` between rows and a `border-y border-border` framing the whole list, not as individually bordered/shadowed cards. Row padding is `py-3.5` (`first:pt-2.5 last:pb-2.5` to balance the frame). This reads as structured, editorial content rather than a stack of identical boxes, and it's the single biggest lever the 2026-09-21 amendment used to move away from the generic-SaaS-dashboard feel.

### Badges
Small pill-shaped metadata tags (`components/Badge.tsx`) — a count ("3 friends"), a status ("Shared with 2 friends", "waiting on you"), a person indicator (a color dot + name on a merged-view event). Always `rounded-full`, Tag typography (normal-case, never tracked-uppercase), one of three tones: `neutral` (Pale Sky fill), `outline` (transparent, Sky Border stroke — the default for factual/contextual tags), `accent` (Accent-Muted fill, Accent text — for a tag that represents an actively-on state). Never interactive on their own; a badge that needs to be clickable is a button styled like one, not a `Badge` with an onClick.

### Inputs / Fields
- **Style:** Sky Border stroke, Paper White background, `rounded-xl`, generous `px-4 py-2.5` padding.
- **Focus:** border shifts to Accent, no glow/ring — kept quiet and precise rather than decorative.
- **Error:** border shifts to Danger; the error message renders below in Danger text with `role="alert"`.

### Navigation
NavBar is sticky (`top-0`) with a translucent, blurred background (`bg-background/85 backdrop-blur-md`) so page content can scroll beneath it without a hard seam — a functional use of blur, not decoration. Links are pill-shaped; the active route gets a Pale Sky fill and full-weight text via `usePathname()`, everything else stays Slate Blue until hovered.

## Do's and Don'ts

### Do:
- **Do** keep every button pill-shaped (`rounded-full`) and every card/input at the 12px/16px radius steps — no intermediate radius values.
- **Do** route every server-action button through `SubmitButton`/`ConfirmSubmitButton` so pending/disabled state is automatic.
- **Do** use Soft shadow at rest and Lifted on hover for any new card or primary button — never introduce a third shadow value.
- **Do** keep the wordmark's tracked-uppercase-Label treatment to exactly one use (the corner mark); never place it above another heading.
- **Do** use `text-display`/`text-headline` for hero and page-level `<h1>`s respectively — the editorial scale is now the baseline, not an exception for `/login`.
- **Do** render a repeated list (events, friends, calendars, slots) as hairline-divided rows (`divide-y divide-border border-y border-border`), and reserve shadow cards for standalone single panels.
- **Do** reach for `Badge` for any inline metadata tag instead of ad hoc `<span>` + color-dot markup.

### Don't:
- **Don't** introduce a second accent color. Danger/success/warning exist for state only and stay desaturated.
- **Don't** add a kicker/eyebrow label above any heading, ever — this was tried once during the build and reverted.
- **Don't** use a hard offset shadow (`box-shadow: Npx Npx 0`) anywhere — this system is not neobrutalist.
- **Don't** switch to a second typeface or a monospace face for "technical" content — tabular figures (`.tabular-nums`) handle aligned numerals within Plus Jakarta Sans itself.
- **Don't** animate more than one element's entrance per view. The `animate-rise-in` utility is applied to a page's outer content wrapper, never cascaded per list item.
- **Don't** wrap a repeated list of same-shape items in individual shadow cards — that's the generic-dashboard pattern this amendment moved away from. Hairline rows only.
- **Don't** give `Badge` the tracked-uppercase Label treatment — Tag style is normal-case specifically so it reads as content, not as a kicker.
