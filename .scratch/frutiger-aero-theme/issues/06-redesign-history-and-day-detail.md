# 06 — Redesign History and historical day detail

**What to build:** Apply the optional Aero world to aggregate History and the
historical-day detail journey while preserving its data, context, and mutations.

**Blocked by:** None

**Priority:** P1

**Status:** ready-for-agent

**State:** closed

- [x] The seven-day chart and summaries become glossy instrumentation over a
      reflective-water environment without changing their values, labels, or
      accessible descriptions.
- [x] Averages, goal comparison, day rows, empty/loading/error states, and
      historical detail share a coherent Aero visual hierarchy.
- [x] Editing entry points, moving, deletion, Undo, and meal duplication remain
      reachable and preserve the established behavior.
- [x] Returning from detail preserves History context and scroll position.
- [x] Mobile, desktop, long localized dates, Aero Day/Night, and reduced motion
      remain contained and operable.
- [x] Standard appearance remains visually and behaviorally unchanged.
- [x] Shared editors and schedule controls are treated as black boxes rather than
      duplicated or edited in this issue.
- [x] Owned unit tests and the frontend production build pass.

## Exclusive ownership

- `frontend/src/app/pages/HistoryPage.tsx`
- `frontend/src/app/pages/HistoryPage.test.ts`
- `frontend/src/app/pages/history/**`
- new unit tests specifically for these owned components
- `frontend/src/styles/aero/history.css`

Reference fixed assets from `../spec.md`; their absence on this isolated branch
does not block implementation. Import the surface stylesheet from an owned file.
Do not edit shared editors, shell/Auth, provider/Settings, DS primitives, locale
files, Today, assets, or E2E coverage.

## Verification

- Run the directly affected unit tests.
- `npm --prefix frontend run build`
- Manually inspect aggregate/detail states in Standard/Aero and Day/Night at the
  maintained responsive matrix.

## Comments

- 2026-08-21: Created from the completed Frutiger Aero design-tree interview.
- 2026-08-21: Completed. History tests, scroll-context regression coverage, frontend build, Aero
  aggregate/detail/duplication browser journeys, and the final full desktop/mobile suite passed.
