# 20 — Implement the approved adaptive desktop UI

**What to build:** Implement the responsive desktop architecture approved in issue 19 while preserving one product behavior model across mobile, tablet, and desktop.

**Blocked by:** 19 — Design an adaptive desktop architecture.

**Priority:** P1

**Status:** ready-for-agent

**State:** closed

- [x] Production layout, components, and responsive state follow the approved issue 19 architecture without introducing a second desktop-only implementation of core journeys.
- [x] Desktop uses available width intentionally and keeps the nutrition dashboard useful while the composer is active.
- [x] Composer, suggestions, compact receipt summary, pending/failure feedback, meal rows, editor, date navigation, History, and whole-meal duplication remain coherent at every supported breakpoint.
- [x] Existing mobile journeys retain their established action counts, focus behavior, keyboard-safe layout, and touch targets unless an approved design explicitly improves them.
- [x] Loading, empty, success, failure, retry, Edit, Delete, Undo, and long localized content states have no clipping, overlap, or inaccessible off-screen controls.
- [x] The scenario inventory is updated and deterministic Playwright coverage exercises every affected journey at representative desktop and mobile sizes; the complete suite passes.

## Implementation sequence

1. Establish the state seam before changing layout: replace the overloaded
   `chatOpen` contract with shared logging-session state plus compact-modal state.
   Only compact-modal state may drive `inert`, background exclusion, or Home
   carousel gesture locking in `AppTabShell`.
2. Deepen the route-level workspace module around the existing `MainPage`
   behavior. The module owns one selected date/meal, draft, suggestion session,
   submission/receipt lifecycle, selected editor entry, and Undo result; its small
   interface exposes the shared view and commands instead of making each
   breakpoint recreate that behavior.
3. Put the responsive composer seam at presentation selection. Keep the existing
   compact Vaul sheet below `768px`, and expose the same logging session through
   the always-visible desktop composer at `768px+`. Width chooses the adapter;
   switching adapters preserves the shared draft, target meal, pending work,
   suggestions, receipts, and equivalent focus without exposing two semantic
   composer surfaces.
4. Implement approved Variant E at `768px+`: a narrow Today/History rail with
   Account and Settings kept together; one continuous food ledger in document
   flow; meal headings with an Add action; and one plain aligned food/portion,
   kcal, protein, carbs, fat, and fiber row. The compact nutrition summary appears
   before the right-aligned date navigator in one physical header row at every
   supported desktop width, with no duplicate totals after Snacks. The visible
   composer follows that header and remains ready for keyboard input. Clicking a
   food opens one inline editor beneath that exact row; it does not introduce a
   desktop-only behavior implementation. Reuse the existing mobile radius,
   primary, secondary, accent, success, and error styles without wrapping the
   workspace, meals, or ledger in decorative cards.
5. Verify every state and long-locale case at compact, tablet, and wide sizes,
   including keyboard order, composer modality only on compact, compact editor
   containment, desktop inline-editor containment, pointer/touch targets, resize continuity,
   Edit/Delete/Undo, failures, and History detail. Exercise both sides of every
   compact/desktop transition at `767/768` and representative widths of
   `900×1024`, `1280×720`, and `1440×900`.
6. Update the scenario inventory and deterministic desktop/mobile journeys, then
   run the focused specs and complete suite with one retained video per result and
   the artifact-safety verifier.

## Seam and interface contract

- **Workspace module:** owns all logging behavior and exposes one interface to
  callers and tests. Its invariants include a single in-flight/session history,
  one meal target, and identical submit/retry/edit/Undo semantics at every width.
- **Composer-surface seam:** receives the shared session view and commands. The
  compact sheet and visible desktop composer may differ in geometry and modality,
  but may not implement business behavior or keep their own drafts/results. The
  desktop composer remains non-modal, visible near the top of the journal, and
  ready for keyboard input at every width of `768px` and above.
- **Shell-lock seam:** receives only `compactModalOpen`. Its adapter applies
  carousel locking and background exclusion on compact mobile; the visible
  desktop composer never crosses this seam.
- **Responsive adapter selection:** is derived from width and owns layout only.
  This keeps the interface small, concentrates responsive complexity at one seam,
  and preserves locality in the route-level workspace module.
- **Saved-entry editor:** remains one shared editor session. Compact mobile keeps
  its focus-contained modal; desktop expands the selected ledger row inline and
  permits only one open editor. If AI instruction and manual edits coexist, AI
  receives the original saved entry and wins. A correction failure keeps every
  entered value and shows one inline error so the user can retry or clear the AI
  instruction and save manually.

## Comments

- 2026-08-17: Implemented approved Variant E in production. Desktop now uses the
  narrow Today/History rail, an always-visible food input, one continuous ledger,
  per-meal Add prefixing, ordered pending/failure rows, a four-second group Undo
  snackbar, and one inline saved-entry editor. Mobile retains its established
  carousel, composer sheet, cards, modal editor, colors, and radii.
- 2026-08-17: The responsive shell keeps one mounted set of route pages, so the
  selected date/meal and food draft survive `767↔768` without resize-triggered
  application requests. The header keeps kcal/protein/carbs/fat/fiber before the
  right-anchored navigator in one physical row at 768×900, 900×1024, 1280×720,
  and 1440×900. Russian, Polish, and Tatar long-date checks cover the same matrix.
- 2026-08-17: Final deterministic evidence passed 164/164 tests with zero skips:
  82 desktop Chromium and 82 mobile WebKit results against the real frontend,
  backend, and isolated PostgreSQL database. The artifact verifier passed and
  retained exactly 164 independent `video.webm` files for 164 results. Frontend,
  backend, tooling, locale, and component/unit suites passed separately. Paid
  live-AI validation is tracked independently by issue 12 and is not claimed here.
