# 20 — Implement the approved adaptive desktop UI

**What to build:** Implement the responsive desktop architecture approved in issue 19 while preserving one product behavior model across mobile, tablet, and desktop.

**Blocked by:** 19 — Design an adaptive desktop architecture.

**Priority:** P1

**Status:** ready-for-agent

- [ ] Production layout, components, and responsive state follow the approved issue 19 architecture without introducing a second desktop-only implementation of core journeys.
- [ ] Desktop uses available width intentionally and keeps the nutrition dashboard useful while the composer is active.
- [ ] Composer, suggestions, compact receipt summary, pending/failure feedback, meal rows, editor, date navigation, History, and whole-meal duplication remain coherent at every supported breakpoint.
- [ ] Existing mobile journeys retain their established action counts, focus behavior, keyboard-safe layout, and touch targets unless an approved design explicitly improves them.
- [ ] Loading, empty, success, failure, retry, Edit, Delete, Undo, and long localized content states have no clipping, overlap, or inaccessible off-screen controls.
- [ ] The scenario inventory is updated and deterministic Playwright coverage exercises every affected journey at representative desktop and mobile sizes; the complete suite passes.
