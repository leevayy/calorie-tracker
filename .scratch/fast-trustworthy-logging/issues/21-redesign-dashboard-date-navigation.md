# 21 — Redesign dashboard date navigation

**What to build:** Replace the visually disconnected dashboard date header with a compact, coherent date navigator in which the selected day is primary, previous/next are secondary, and returning to today is unmistakably an action rather than a status label.

**Blocked by:** 07 — Navigate and log another day; 16 — Use shared date and meal inputs across editing and duplication; 20 — Implement the approved adaptive desktop UI.

**Priority:** P1

**Status:** ready-for-agent

**State:** closed

- [x] The selected date, Previous, and Next read as one composed control rather than three elements spread across a large block.
- [x] The selected date is the visual focus; Previous and Next keep at least 44 by 44 CSS-pixel targets without visually dominating the date.
- [x] A Today action appears only when another date is selected, is visually recognizable as an action, returns to today in one activation, and does not cause disruptive layout shift when it appears or disappears.
- [x] Activating the selected date opens the shared Date input or picker for direct navigation without adding a separate date implementation.
- [x] Accessible Previous and Next names include their destination dates, and selected-day changes are announced without duplicate live-region output.
- [x] Long Russian, Polish, and Tatar dates fit at 320, 390, and 430 CSS-pixel widths and in the approved desktop layout without clipping or excessive empty space.
- [x] The scenario inventory and deterministic desktop/mobile tests cover today, an adjacent day, direct selection, month/year boundaries, localized long dates, keyboard focus, and one-action return to today.

## Comments

- 2026-08-16: Added a shared `DateNavigator` with a compact grouped control, 44-pixel destination-labelled arrows, a primary direct-date trigger backed by the common `DateInput`, a reserved Today action slot, and one polite selected-day status. Unit and deterministic desktop/mobile scenarios cover navigation, direct month/year selection, locale widths, focus, announcements, and return to today. Validation in the not-yet-approved adaptive desktop layout remains outstanding, so the corresponding fit criterion stays open.
- 2026-08-16: The final browser matrix passed all adjacent/direct/boundary/focus/
  Today and 320/390/430-pixel Russian, Polish, and Tatar checks in desktop Chromium
  and mobile WebKit. The sole unchecked clause remains validation in the approved
  production desktop layout after issue 19 approval and issue 20 implementation.
- 2026-08-16: Issue 20 is an explicit blocker because the remaining criterion can
  only validate tablet and wide-desktop fit, including the absence of excessive
  empty space, after the approved adaptive layout exists in production.
- 2026-08-16: The consolidated hardened matrix again passed the compact date
  navigator journeys as part of 152/152 deterministic results (76 desktop
  Chromium and 76 mobile WebKit, zero skips). This confirms the implemented
  320/390/430-pixel behavior but does not satisfy or waive the still-unbuilt
  approved tablet/wide-desktop clause.
- 2026-08-17: Approved Variant E replaces the superseded split date/nutrition
  strip contract. At every supported desktop width (`768px+`), the compact
  kcal/protein/carbs/fat/fiber summary must precede the right-aligned navigator
  in one physical header row. Neither group may wrap, overlap, clip, or create a
  duplicate nutrition summary below the ledger. Long-locale desktop evidence
  remains planned until Issue 20 is implemented and run.
- 2026-08-17: Production validation is complete. The compact desktop navigator
  remains mounted while day data reloads, retains keyboard focus on an activated
  arrow, and exposes an inline one-action Today control only while off today.
  Russian, Polish, and Tatar headers passed at 768×900, 900×1024, 1280×720, and
  1440×900 with the full nutrition/date row contained and without document
  overflow; the existing 320/390/430 compact checks also passed.
- 2026-08-17: The focused date matrix passed 18/18 results (9 desktop Chromium,
  9 mobile WebKit) with zero skips and 18 videos. The final deterministic matrix
  then passed 164/164 with zero skips, exactly 164 videos, and clean artifact
  verification. All acceptance criteria are satisfied; issue 21 is closed.
