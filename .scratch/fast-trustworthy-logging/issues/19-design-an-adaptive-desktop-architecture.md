# 19 — Design an adaptive desktop architecture

**What to build:** Architect and prototype a genuinely adaptive desktop product instead of stretching the current mobile column. Define the responsive information architecture, component/state boundaries, and complete-journey behavior before changing production layout code.

**Blocked by:** 14 — Keep logging receipts compact; 15 — Make historical suggestions keyboard-first; 16 — Use shared date and meal inputs; 17 — Add an explicit composer meal target; 18 — Edit and resubmit a failed description.

**Priority:** P1

**Status:** ready-for-human

**State:** closed

- [x] The proposal documents how Dashboard, composer, meal rows, receipts, suggestions, editor, History, and navigation use additional desktop width while preserving the fast logging focus.
- [x] The proposal defines responsive component ownership and state seams so mobile and desktop share product behavior without maintaining separate feature implementations.
- [x] Closed, typing, pending, success, long-burst receipt, suggestion, parse failure, save failure, edit, and Undo states are represented at desktop widths.
- [x] Representative prototypes cover at least compact mobile, tablet/narrow desktop, and wide desktop sizes in light and dark themes.
- [x] All ten maintained product journeys are walked through in the prototype, including whether the nutrition dashboard remains useful during active logging.
- [x] Keyboard order, focus containment, touch/pointer behavior, density, long localized content, and accessibility semantics are explicitly evaluated.
- [x] Trade-offs and the recommended architecture are presented for human approval; issue 20 remains blocked until that approval is recorded.

## Approved journal direction

Human review rejected variants A-D and the A/C hybrid as too dense while still
wasting space: cards, panels, and dashboard hierarchy outweighed the product's
essential material of one input, food text, and nutrition numbers. The former
A/C approval request is withdrawn.

New throwaway variants on `/app?variant=E|F|G` share the approved interaction
decisions while testing three minimal document structures:

- E — one continuous ruled food ledger with a single metric header;
- F — whitespace-separated meal sections in a plain outline; and
- G — meal names/Add actions in an integrated gutter beside the ledger.

All keep a narrow Today/History rail, right-aligned date row, always-visible AI
input, current-time meal inference, per-meal Add prefixing, ordered concurrent
pending rows, quick result snackbar with group-specific Undo, collapsible meals,
plain kcal/P/C/F/fiber columns, and one inline editor transaction for AI or
manual changes. Human review selected **E — continuous ledger**. Its nutrition
summary moves into the page header before the right-aligned date navigator on
desktop; the final human refinement requires both groups to remain in one
physical row at every maintained desktop width from `768px` upward. The
duplicate bottom summary is removed. This approval unblocks issue 20.

## Superseded A/C proposal (rejected)

**Former recommendation:** The **A/C hybrid** combined A's single deep route-level
workspace and stable behavior sessions, combined with C's selected-meal emphasis
and persistent tablet/wide Log Dock.

**Non-negotiable responsive contract:**

- Below `768px`, compact mobile keeps the existing modal bottom-sheet journey,
  including focus containment, background exclusion, and temporary Home-carousel
  gesture locking.
- From `768px` through `1279px`, the workspace uses a `5rem` navigation rail, two
  meal columns, and a non-modal Log Dock mounted after the workspace in DOM order
  and held at the viewport bottom with `position: sticky`.
- At `1280px` and above, the rail becomes `13rem`, the workspace keeps two primary
  lanes, History detail uses a non-modal side inspector, and the saved-entry
  editor becomes a modal, focus-contained right side-sheet.
- At `1440px` and above, the meal board expands to four meal lanes. At `896px` and
  above, date navigation and nutrition share one strip.
- At every width of `768px` and above, the Log Dock stays at the bottom and in
  flow so DOM, visual, and keyboard order agree; `sticky; bottom: 0` makes it
  persistently visible without fixed-position padding guesses. Its expanded
  height is capped at `min(22rem, 42dvh)`; it is non-modal, never makes the
  nutrition/meal workspace inert, and never locks route navigation merely
  because it is present.
- At `896px` and above, the date/nutrition strip uses a content-sized date column
  plus a flexible nutrition column (`auto minmax(0, 1fr)`) with a `16–24px` gap.
  The date navigator uses `width: max-content; max-width: 100%`; its rendered
  width may leave no more than `16px` unused in its assigned column. That is the
  measurable meaning of “without excessive empty space.”

Resizing changes only the presentation adapter: selected day and meal, draft
text, suggestion state, pending/failure work, receipts, editor selection, and Undo
state survive without a second desktop behavior implementation.

**Required state seams:** The route-level workspace owns the one shared logging
behavior session. A separate compact-modal state owns only drawer presence,
background exclusion, and shell gesture locking. Responsive surface selection is
derived from available width and chooses either the compact-sheet adapter or the
persistent-dock adapter; it is not stored as a second behavior state. Editor and
Undo state remain shared by both adapters. In particular, the current `chatOpen`
state must not continue to conflate composer visibility with shell locking.
The saved-entry editor remains a modal dialog at every width, preserving the
existing focus-containment and background-exclusion contract; only its geometry
changes into a right side-sheet at `1280px` and above. History detail is the
non-modal desktop inspector.

**Rejected alternative:** Variant B's general surface registry is deliberately
deferred. It adds a broad, shallow interface before multiple independent workspace
surfaces exist and therefore does not yet earn a real seam; a separate desktop
feature tree is also outside the proposal.

The former approval phrase `approve the A/C hybrid` is withdrawn and must not be
used to unblock production.

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
- 2026-08-16: Removed issue 21 as a whole-ticket blocker to make the dependency
  explicit and acyclic. The prototype uses issue 21's already-implemented shared
  compact navigator; issue 21's remaining approved-desktop fit validation follows
  issue 20 and therefore does not block the issue 19 architecture decision.
- 2026-08-16: Added Variant D, **Exact pending A/C hybrid**, on throwaway branch
  `codex/adaptive-desktop-prototypes` at commit `13cb575`. Unlike the earlier A-C
  selector sweep, D renders distinct Dashboard, History correction,
  meal-duplication, and Settings review surfaces for the exact pending contract.
  The fresh Chromium-only prototype packet at
  `/private/tmp/calorie-tracker-variant-d-qa-evidence` contains 24 distinct review
  captures and reports 100 journey checks, 100 state checks, 50 locale/containment
  checks, 90 localized-journey checks, 13 cross-journey checks, 5 interaction
  checks, and 13 in-page resize checks with zero failures. Its report SHA-256 is
  `a503f89ea1505e4de48a055105237d983919c6f7aa71928bbfa3e5f65ef16b1b`.
  Independent contract and adversarial-harness audits found no mismatch. This is
  synthetic, in-memory prototype evidence—not a production implementation,
  production-stack Playwright/database persistence, live-AI result, or human
  approval. At that point Issue 19 remained open and `ready-for-human`; the
  recommendation and its approval phrase were later withdrawn after human review.
- 2026-08-17: Human review rejected A-D's panel-heavy workspace premise. Added
  minimal journal variants E/F/G on throwaway branch
  `codex/adaptive-desktop-prototypes` at commit `a13b9b2`. The frontend build
  passes; synthetic Chromium checks exercised meal-prefix transformation, all
  explicit meal destinations plus current-time fallback, ordered concurrent
  submissions and snackbar-specific Undo ownership, collapse, Settings access,
  manual/AI inline editing, retained fields/instruction on AI failure, and page
  containment for E/F/G at 768, 1024, and 1440 CSS pixels. This is prototype-only
  evidence, not production-stack Playwright or approval. Issue 20 remains blocked
  pending human selection among the new journal structures.
- 2026-08-17: Human review approved Variant E, the continuous ledger, and refined
  its header to place the compact kcal/protein/carbs/fat/fiber summary before the
  date navigator. A final review correction requires one physical row at every
  maintained desktop width (`768px+`), including the narrowest desktop layout;
  the earlier two-row allowance is superseded. The bottom duplicate was removed.
  The approved prototype is captured on
  `codex/adaptive-desktop-prototypes` at commit `86e9fa1`. Frontend build passed,
  and synthetic Chromium checks at 768, 1024, and 1440 CSS pixels found no page
  overflow. Issue 19 is closed and issue 20 is unblocked for production work.
