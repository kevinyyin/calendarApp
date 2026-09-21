---
target: the whole web app
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-09-21T04-34-07Z
slug: the-whole-web-app
---
## Design Health Score (Round 2)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | SubmitButton's spinner/pending pattern is consistent everywhere; no ambient Realtime connection state, no success toast beyond the row itself changing |
| 2 | Match System / Real World | 3/4 | Plain, calendar-native vocabulary throughout |
| 3 | User Control and Freedom | 3/4 | Real improvement (unfriend, cancel, hide/show) but no true undo beyond window.confirm, and global-error.tsx has no escape hatch if retry fails |
| 4 | Consistency and Standards | 2/4 | Destructive actions (Remove, Decline, the "Sharing" toggle) never use the app's own --danger token; confirm-gating applied to Share/Remove but not Unshare/Decline with no visible rule |
| 5 | Error Prevention | 3/4 | Confirm dialogs are well-targeted with dynamic, specific copy; find-time disables submit with zero friends selected |
| 6 | Recognition Rather Than Recall | 3/4 | Everything needed is listed in place, no cross-page memory required |
| 7 | Flexibility and Efficiency | 1/4 | No "select all" in the friend picker, no persisted duration, no way to collapse sections on the now-5-block Friends page |
| 8 | Aesthetic and Minimalist Design | 3/4 | Still restrained; Friends page is getting dense but each block is legibly bordered |
| 9 | Error Recovery | 3/4 | Inline field errors are specific and actionable; generic error.tsx copy is fine but undifferentiated |
| 10 | Help and Documentation | 2/4 | The find-a-time search's 8am-10pm window (real, intentional, correctly implemented) is never mentioned in the UI |
| **Total** | | **26/40** | **Acceptable** |

## What Changed Since Round 1

Unfriend, sent-request visibility + cancel, self-service username editing, sharing confirmation with dynamic audience copy, error/loading boundaries, consistent date/time formatting, and larger touch targets on the nav and home page -- all confirmed present and working. The growth surfaced new problems: the Friends page went from two blocks to five stacked sections with no priority ordering, and the newest buttons didn't inherit the touch-target and styling conventions established elsewhere.

## Accessibility Findings

- FindTimeForm checkboxes: correctly implemented, no bug.
- ConfirmSubmitButton: no double-fire or focus-trap issue; window.confirm() is the safe choice here.
- error.tsx/global-error.tsx: no focus shift and no live region when these boundaries mount.

## Priority Issues

[P1] Friends page buries the actionable item -- UsernameForm renders first, ahead of Pending requests.
[P2] Inconsistent destructive-action treatment -- Remove/Decline/"Sharing" never use the --danger token; confirm-gating has no visible rule.
[P2] Undersized touch targets on the newest buttons -- Accept/Decline/Cancel/Remove are px-3 py-1 (~28px) vs py-2 elsewhere in the same feature set.
[P2] Error boundaries give no accessible announcement.
[P3] global-error.tsx has no escape hatch if retry fails.
[P3] "Sharing" as a button label reads as a status chip, not a control.

## Minor Observations Being Fixed

- Find-a-time's real 8am-10pm search window is never disclosed in the UI.
- Duration input has no upper bound.

## Not Fixed (deliberately out of scope)

- Input-classname duplication across three forms (code-organization nit, zero user-visible effect).
- NavBar scroll-shadow affordance (no actual mobile overflow found by live browser evidence).
- Visual personality/branding (declined by the product owner in round 1).
