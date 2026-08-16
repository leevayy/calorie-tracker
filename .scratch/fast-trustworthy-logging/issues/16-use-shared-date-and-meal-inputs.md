# 16 — Use shared date and meal inputs across editing and duplication

**What to build:** Replace the divergent date and meal controls in individual-entry editing and whole-meal duplication with shared product components and one behavior contract.

**Blocked by:** 02 — Edit a saved food entry; 09 — Duplicate a previous meal.

**Priority:** P1

**Status:** ready-for-agent

- [x] Individual-entry editing and whole-meal duplication render the same shared Date input and Meal input components rather than locally reimplementing them.
- [x] Labels, field order, dimensions, icons, meal options, date formatting, disabled states, validation, and error presentation are consistent in both journeys.
- [x] The shared components have one typed value/change contract and do not contain mutation-specific save logic.
- [x] Keyboard behavior, touch targets, focus treatment, and screen-reader labels are consistent on desktop and mobile.
- [x] Every supported locale renders long dates and translated meal names without clipping or horizontal overflow.
- [x] The scenario inventory and deterministic desktop/mobile tests cover valid changes, invalid dates, locale rendering, entry moves, and whole-meal duplication through the shared controls.

## Comments

- 2026-08-16: Extracted typed, controlled `DateInput`, `MealInput`, and `ScheduleInputs` components and reused the combined control in entry correction and meal duplication without mutation logic. The 112/112 frontend run covers the shared contract and error/disabled states; mapped desktop/mobile Playwright coverage exercises valid and invalid moves/duplication, 44-pixel targets, field order, and all five supported locales without overflow in the running complete matrix.
