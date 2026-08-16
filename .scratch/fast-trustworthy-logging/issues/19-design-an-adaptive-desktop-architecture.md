# 19 — Design an adaptive desktop architecture

**What to build:** Architect and prototype a genuinely adaptive desktop product instead of stretching the current mobile column. Define the responsive information architecture, component/state boundaries, and complete-journey behavior before changing production layout code.

**Blocked by:** 14 — Keep logging receipts compact; 15 — Make historical suggestions keyboard-first; 16 — Use shared date and meal inputs; 17 — Add an explicit composer meal target; 18 — Edit and resubmit a failed description; 21 — Redesign dashboard date navigation.

**Priority:** P1

**Status:** ready-for-human

- [x] The proposal documents how Dashboard, composer, meal rows, receipts, suggestions, editor, History, and navigation use additional desktop width while preserving the fast logging focus.
- [x] The proposal defines responsive component ownership and state seams so mobile and desktop share product behavior without maintaining separate feature implementations.
- [x] Closed, typing, pending, success, long-burst receipt, suggestion, parse failure, save failure, edit, and Undo states are represented at desktop widths.
- [x] Representative prototypes cover at least compact mobile, tablet/narrow desktop, and wide desktop sizes in light and dark themes.
- [x] All ten maintained product journeys are walked through in the prototype, including whether the nutrition dashboard remains useful during active logging.
- [x] Keyboard order, focus containment, touch/pointer behavior, density, long localized content, and accessibility semantics are explicitly evaluated.
- [x] Trade-offs and the recommended architecture are presented for human approval; issue 20 remains blocked until that approval is recorded.

## Comments

- 2026-08-16: Built three structurally distinct, read-only variants on the existing
  `/app?variant=A|B|C` route and captured the primary source on throwaway branch
  `codex/adaptive-desktop-prototypes` at commit `d79e7ba`. Variant A is a Command
  Shelf plus two-column Meal Board, B is an Adaptive Surface Workbench with a
  command/activity dock, and C is a Meal Board plus persistent Log Dock.
- 2026-08-16: The recommended production architecture uses A's single deep
  route-level workspace and stable behavior sessions, with C's selected-meal
  emphasis and persistent tablet/wide Log Dock. B's surface registry is deferred
  until the product has enough independent workspace surfaces to justify it.
- 2026-08-16: Prototype QA covered 18 compact/tablet/wide light/dark captures and
  30 journey/state sweeps. It found no horizontal overflow, undersized visible
  product controls, page/console errors, or input/listbox ordering failures;
  left/right variant switching also stayed inactive while the input was focused.
  Human approval is still required, so issue 20 remains blocked.
- 2026-08-16: A follow-up consistency audit aligned the three variants on the
  same Sunday date, Dinner target, nutrition and meal fixtures, corrected burst
  totals, and repaired the narrow-rail label. All 18 captures and 30 journey/state
  sweeps were regenerated with zero overflow, undersized-control, or console/page
  failures; the throwaway worktree is clean at `d79e7ba`.
