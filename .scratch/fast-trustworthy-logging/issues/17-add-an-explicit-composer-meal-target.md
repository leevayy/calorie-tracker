# 17 — Add an explicit composer meal target

**What to build:** Show the meal that the composer will use and let the user change it in one action, without adding a mandatory review step or a separate manual-entry workflow.

**Blocked by:** 04 — Automatically save AI-recognized foods; 06 — Suggest previously logged foods while typing; 07 — Navigate and log another day; 16 — Use shared date and meal inputs across editing and duplication.

**Priority:** P1

**Status:** ready-for-agent

**State:** closed

- [x] The composer visibly identifies its current target meal before submission and uses the currently selected dashboard day.
- [x] The target meal can be changed with one explicit action using the shared meal control, while the clock-derived meal remains a sensible zero-action default.
- [x] Natural-language AI submissions and historical suggestion reuse both save to the selected day and target meal.
- [x] An explicitly stated meal in the natural-language description may override the default target according to one documented precedence rule.
- [x] Choosing a target never introduces an obligatory confirmation or clarification step before logging.
- [x] Deterministic desktop/mobile tests cover the default meal, a changed target, a different selected day, historical AI bypass, explicit natural-language meal intent, and consecutive submissions.

## Comments

- 2026-08-16: Added the shared Meal control to the composer with a local-clock default and submission timing that binds the selected dashboard day and target meal; historical reuse bypasses AI, while parser-returned explicit meal intent takes documented precedence over the fallback. All four mapped Issue 17 scenarios passed in the 14/14 desktop composer run and are registered for mobile in the running complete matrix.
- 2026-08-16: Closed with consolidated verification: backend 84/84,
  frontend 118/118, production build and backend check green, and deterministic
  Playwright 152/152 (76 desktop + 76 mobile) with zero skipped, unexpected, or
  flaky results, 152 separate videos, and clean artifact verification.
