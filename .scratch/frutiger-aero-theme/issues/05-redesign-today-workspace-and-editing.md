# 05 — Redesign the Today workspace and editing interactions

**What to build:** Apply the optional Aero world to the complete Today, logging,
meal, suggestion, receipt, editor, and Undo journey on mobile and desktop.

**Blocked by:** None

**Priority:** P1

**Status:** ready-for-agent

**State:** closed

- [x] Calorie and macronutrient summaries become glossy gauges, liquid meters,
      glass instrumentation, or similarly strong original Aero metaphors without
      changing values or accessible descriptions.
- [x] Composer, meal targeting, suggestions, pending/failure rows, receipts,
      editors, deletion, retry, and Undo receive coherent Aero treatments.
- [x] Skeuomorphic clutter, strong shine, and low-density composition are used
      deliberately in framing and summaries.
- [x] Food names, nutrient values, forms, failure recovery, and destructive
      actions remain locally calm and readable.
- [x] Keyboard-fast desktop logging, the mobile composer sheet, keyboard
      visibility, safe areas, and 44px primary targets remain operable.
- [x] Route, selected date/meal, draft, suggestions, pending/failure work,
      receipts, editor, and Undo state survive `767/768` resizing without a
      second behavior implementation or resize-triggered application requests.
- [x] Aero Day, Aero Night, reduced motion, loading/empty/error/success states,
      and long localized content are treated intentionally.
- [x] Standard appearance remains visually and behaviorally unchanged.
- [x] Owned unit tests and the frontend production build pass.

## Exclusive ownership

- `frontend/src/app/pages/MainPage.tsx`
- `frontend/src/app/pages/main/**`
- `frontend/src/app/components/CaloriePieChart.tsx`
- `frontend/src/app/components/DateNavigator.tsx`
- `frontend/src/app/components/DayMacrosLabels.tsx`
- `frontend/src/app/components/MealSection.tsx`
- `frontend/src/app/components/DesktopMealSection.tsx`
- `frontend/src/app/components/FoodSuggestion.tsx`
- `frontend/src/app/components/FoodEntryEditor.tsx`
- `frontend/src/app/components/DesktopFoodEntryEditor.tsx`
- `frontend/src/app/components/DesktopLoggingSnackbar.tsx`
- `frontend/src/app/components/ScheduleInputs.tsx`
- tests corresponding to the owned files
- `frontend/src/styles/aero/today.css`

Reference fixed assets from `../spec.md`; their absence on this isolated branch
does not block implementation. Import the surface stylesheet from an owned file.
Do not edit shell/Auth, provider/Settings, DS primitives, locale files, History,
assets, or E2E coverage.

## Verification

- Run the directly affected unit tests.
- `npm --prefix frontend run build`
- Manually inspect the full state set in Standard/Aero and Day/Night at the
  maintained responsive matrix.

## Comments

- 2026-08-21: Created from the completed Frutiger Aero design-tree interview.
- 2026-08-21: Completed. Owned Today tests passed, full frontend tests/build passed, Aero workflow
  and responsive coverage passed in both browser projects, and the integration run corrected one
  styling-hook collision before the final deterministic suite passed.
