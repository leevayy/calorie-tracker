# 21 — Redesign dashboard date navigation

**What to build:** Replace the visually disconnected dashboard date header with a compact, coherent date navigator in which the selected day is primary, previous/next are secondary, and returning to today is unmistakably an action rather than a status label.

**Blocked by:** 07 — Navigate and log another day; 16 — Use shared date and meal inputs across editing and duplication.

**Priority:** P1

**Status:** ready-for-agent

- [x] The selected date, Previous, and Next read as one composed control rather than three elements spread across a large block.
- [x] The selected date is the visual focus; Previous and Next keep at least 44 by 44 CSS-pixel targets without visually dominating the date.
- [x] A Today action appears only when another date is selected, is visually recognizable as an action, returns to today in one activation, and does not cause disruptive layout shift when it appears or disappears.
- [x] Activating the selected date opens the shared Date input or picker for direct navigation without adding a separate date implementation.
- [x] Accessible Previous and Next names include their destination dates, and selected-day changes are announced without duplicate live-region output.
- [ ] Long Russian, Polish, and Tatar dates fit at 320, 390, and 430 CSS-pixel widths and in the approved desktop layout without clipping or excessive empty space.
- [x] The scenario inventory and deterministic desktop/mobile tests cover today, an adjacent day, direct selection, month/year boundaries, localized long dates, keyboard focus, and one-action return to today.

## Comments

- 2026-08-16: Added a shared `DateNavigator` with a compact grouped control, 44-pixel destination-labelled arrows, a primary direct-date trigger backed by the common `DateInput`, a reserved Today action slot, and one polite selected-day status. Unit and deterministic desktop/mobile scenarios cover navigation, direct month/year selection, locale widths, focus, announcements, and return to today. Validation in the not-yet-approved adaptive desktop layout remains outstanding, so the corresponding fit criterion stays open.
- 2026-08-16: The final browser matrix passed all adjacent/direct/boundary/focus/
  Today and 320/390/430-pixel Russian, Polish, and Tatar checks in desktop Chromium
  and mobile WebKit. The sole unchecked clause remains validation in the approved
  production desktop layout after issue 19 approval and issue 20 implementation.
