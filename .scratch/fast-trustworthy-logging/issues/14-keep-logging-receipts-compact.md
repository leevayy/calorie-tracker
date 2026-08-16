# 14 — Keep logging receipts compact without hiding prior results

**What to build:** Replace the vertically growing receipt stack with a compact activity summary that keeps every result from the current logging burst reachable without pushing historical suggestions out of the fast path. Showing only the latest receipt is explicitly not acceptable. A horizontal rail is one possible design, not a mandated solution.

**Blocked by:** 04 — Automatically save AI-recognized foods; 05 — Make the logging composer resilient and keyboard-fast; 06 — Suggest previously logged foods while typing.

**Priority:** P1

**Status:** ready-for-agent

- [x] Every receipt from the current logging burst remains reachable; the UI never reduces the burst to only its latest result.
- [x] Matching historical suggestions remain directly below the composer input and visible without vertical scrolling after at least ten consecutive successful submissions.
- [x] The receipt summary has bounded vertical height and communicates the number and state of logged groups without overwhelming the composer.
- [x] Edit and Undo remain available for the appropriate receipt, and receipt dates remain unambiguous after the selected dashboard day changes.
- [x] If the chosen design scrolls horizontally, its touch gestures do not accidentally navigate the Settings/Home/History tab carousel, and all receipts remain operable by keyboard and assistive technology.
- [x] The scenario inventory and deterministic desktop/mobile Playwright coverage include a long logging burst, receipt navigation, suggestion visibility, Edit, Undo, and a selected-day change.

## Comments

- 2026-08-16: Implemented a bounded, vertically collapsible activity list that retains every receipt below historical suggestions, summarizes group/food counts, and keeps explicit dates plus labeled Edit/Undo controls. The mapped long-burst and selected-day Playwright scenarios passed in the 14/14 desktop composer run; the same scenarios are registered for mobile, and the frontend suite passed 112/112 while the complete browser matrix continues.
