---
name: Overlap
description: A calm, premium merged-calendar tool for a small circle of friends.
colors:
  background: "#faf8f5"
  surface: "#ffffff"
  surface-muted: "#f2ede6"
  foreground: "#211d19"
  muted: "#746b60"
  border: "#e6ded3"
  accent: "#0f766e"
  accent-foreground: "#ffffff"
  accent-muted: "#e3f2ef"
  danger: "#b3452f"
  danger-muted: "#fbeee9"
  success: "#3f7a52"
  warning: "#a15c1f"
  warning-muted: "#faf0e2"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
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
---

# Design System: Overlap

## Overview

**Creative North Star: "The Quiet Concierge"**

Overlap exists to take a small, mundane chore — figuring out when a handful of friends are all free — and handle it with the unhurried confidence of someone who's good at their job and never makes you feel rushed. The system refuses the generic Tailwind-indigo SaaS-dashboard default: no cold slate grays, no scattershot card grids, no kicker labels announcing what a heading already says on its own. It borrows Apple's marketing-page restraint — generous type scale, huge quiet margins, one idea per screen — but stays an Operate-mode tool throughout: nothing here exists to persuade, only to help. Things 3 and Fantastical set the calibration for warmth: this should feel tactile and considered, never clinical.

Both light and dark modes are supported (OS-driven, no manual toggle) because the app is genuinely used at any hour — a scene-based choice, not a category default.

**Key Characteristics:**
- Warm neutrals throughout — ivory and soft charcoal, never cold slate or blue-black
- One confident accent (deep pine teal) carrying every primary action and piece of state
- One typeface, one scale, no display/body split
- Soft dual-layer shadows for depth; no hard offset "neobrutalist" shadows anywhere
- Pill-shaped controls; rounded-corner cards; nothing sharp-edged
- One entrance moment per view (a quiet rise-and-fade), never scattered per-element animation

## Colors

Warm and restrained: two neutrals (background, surface) that read as ivory paper rather than clinical white, one confident accent, and semantic colors (danger/success/warning) tuned to sit in the same warm family rather than clashing cold primaries.

### Primary
- **Deep Pine Teal** (`#0f766e`, dark mode `#4fd1c1`): the only accent in the system. Carries every primary action (Sign in, Save, Accept, Share), the nav's active wordmark, and links. Verified ≥5:1 contrast against both its foreground pairing and the page background in both themes.

### Neutral
- **Warm Ivory** (`#faf8f5`, dark mode `#1a1613`): page background. Never pure white or near-black — always a hair warm.
- **Paper White** (`#ffffff`, dark mode `#221d19`): card/surface background, one step lighter than the page so cards read as raised paper, not a boxed panel.
- **Soft Sand** (`#f2ede6`, dark mode `#2b2521`): muted surface for secondary buttons and hover states.
- **Warm Charcoal** (`#211d19`, dark mode `#f3ede4`): primary text. 15.4–15.8:1 contrast against the page background in both themes.
- **Warm Taupe** (`#746b60`, dark mode `#a89d90`): secondary/muted text — captions, helper copy, timestamps.
- **Sand Border** (`#e6ded3`, dark mode `#3a332c`): the only border color in the system.

### Named Rules
**The One Accent Rule.** Deep Pine Teal is the only saturated color in the interface. Danger, success, and warning exist for semantic state only and are deliberately desaturated toward the same warm family — never a clashing pure red/green/amber pulled from a generic palette.

## Typography

**Display/Body Font:** Plus Jakarta Sans (with `ui-sans-serif, system-ui, sans-serif` fallback)

**Character:** One humanist sans-serif throughout, at a generous scale, weighted 600 for anything that needs to lead and 400 for everything that supports it. No serif, no mono, no second family — restraint is the point.

### Hierarchy
- **Display** (600, `clamp(2.25rem, 5vw, 3rem)`, 1.1 line-height, -0.02em tracking): the one first-viewport headline per page (`/login`'s "See when you're both free", each page's `<h1>`).
- **Headline** (600, 1.875rem, 1.2 line-height, -0.02em tracking): section leads inside authenticated pages.
- **Body** (400, 1rem, 1.6 line-height): supporting copy, form helper text.
- **Label** (600, 0.75rem, 0.2em tracking, uppercase): reserved for exactly one use — the "Overlap" wordmark — never repeated as a decorative kicker above other headings.

### Named Rules
**The No-Kicker Rule.** No small tracked label ever sits directly above a heading as a category/eyebrow tag. The wordmark lives in its own corner position instead — a lesson learned mid-build, when the wordmark-above-headline treatment on `/login` turned out to be the banned kicker pattern in different clothes.

## Layout

Single-column, content-first layouts throughout (`max-w-lg` for form-heavy pages like Friends/Calendars, `max-w-2xl` for the denser merged view). Generous vertical rhythm: pages open with `py-16`–`py-20` rather than the previous system's `py-10`, and major sections separate with `mb-10`–`mb-12`. More space sits above a heading than below it. Responsive behavior relies on Tailwind's default breakpoints; the login headline steps from `text-4xl` to `text-5xl` at `sm`, and NavBar's link row scrolls horizontally on narrow viewports rather than collapsing into a drawer (a known, accepted tradeoff, not an oversight).

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
- **Primary:** Deep Pine Teal background, white text, `px-5 py-2.5`–`py-3` depending on context, Soft shadow at rest, Lifted on hover, `active:scale-[0.98]` on press with the exponential-ease-out timing token (`cubic-bezier(0.16, 1, 0.3, 1)`, 200–300ms).
- **Danger:** Danger-Muted background with Danger text (never a filled saturated red) — used for Decline, Remove, Unshare. Deliberately quieter than Primary so a destructive action doesn't visually shout louder than the page's one accent.
- **Quiet:** Soft Sand background with Warm Taupe text — used for Cancel and other low-stakes secondary actions.
- **Pending state:** every button routes through `SubmitButton` (`useFormStatus`), which swaps the label for a spinner + contextual verb ("Saving…", "Sharing…") and disables itself — this is the system's Visibility-of-status backbone, not a per-button reimplementation.

### Cards / Containers
- **Corner Style:** 12px (`rounded-xl`) for compact rows, 16px (`rounded-2xl`) for page-level cards (the username editor, empty states).
- **Background:** Paper White (Surface).
- **Shadow Strategy:** Soft at rest, Lifted on hover — see Elevation & Depth.
- **Border:** Sand Border, 1px, always present even where a shadow also exists — the two are not redundant, the border keeps the edge crisp at small sizes where the shadow is barely visible.
- **Internal Padding:** `p-4`–`p-6` depending on density; empty states use `p-10` for breathing room.

### Inputs / Fields
- **Style:** Sand Border stroke, Paper White background, `rounded-xl`, generous `px-4 py-2.5` padding.
- **Focus:** border shifts to Accent, no glow/ring — kept quiet and precise rather than decorative.
- **Error:** border shifts to Danger; the error message renders below in Danger text with `role="alert"`.

### Navigation
NavBar is sticky (`top-0`) with a translucent, blurred background (`bg-background/85 backdrop-blur-md`) so page content can scroll beneath it without a hard seam — a functional use of blur, not decoration. Links are pill-shaped; the active route gets a Soft Sand fill and full-weight text via `usePathname()`, everything else stays Warm Taupe until hovered.

## Do's and Don'ts

### Do:
- **Do** keep every button pill-shaped (`rounded-full`) and every card/input at the 12px/16px radius steps — no intermediate radius values.
- **Do** route every server-action button through `SubmitButton`/`ConfirmSubmitButton` so pending/disabled state is automatic.
- **Do** use Soft shadow at rest and Lifted on hover for any new card or primary button — never introduce a third shadow value.
- **Do** keep the wordmark's tracked-uppercase-Label treatment to exactly one use (the corner mark); never place it above another heading.

### Don't:
- **Don't** introduce a second accent color. Danger/success/warning exist for state only and stay desaturated.
- **Don't** add a kicker/eyebrow label above any heading, ever — this was tried once during the build and reverted.
- **Don't** use a hard offset shadow (`box-shadow: Npx Npx 0`) anywhere — this system is not neobrutalist.
- **Don't** switch to a second typeface or a monospace face for "technical" content — tabular figures (`.tabular-nums`) handle aligned numerals within Plus Jakarta Sans itself.
- **Don't** animate more than one element's entrance per view. The `animate-rise-in` utility is applied to a page's outer content wrapper, never cascaded per list item.
