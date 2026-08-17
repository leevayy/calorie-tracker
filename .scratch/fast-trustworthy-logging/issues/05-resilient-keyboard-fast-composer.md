# 05 — Make the logging composer resilient and keyboard-fast

**What to build:** Optimize the food composer for consecutive keyboard-driven logging. The user should see pending work, retain control during failures, and never need to retype a failed submission.

**Blocked by:** 04 — Automatically save AI-recognized foods.

**Priority:** P0

**Status:** ready-for-agent

**State:** closed

- [x] Pressing Enter submits the current description and leaves the composer ready for the next entry.
- [x] A pending representation appears in the target meal while parsing and saving are in progress.
- [x] A failed parse or save preserves the exact submitted text and provides a direct retry action.
- [x] Explicit portion, calorie, and nutrient values supplied in the description take precedence over inferred values through the production parser without silent normalization.
- [x] Automated interaction tests cover consecutive submissions, failure recovery, focus behavior, and production-path explicit nutrition handling on desktop and mobile.

## Comments

- 2026-08-15: Added concurrent keyboard submissions, meal-level parsing/saving rows, stage-aware retry with exact input preservation, explicit-value parser precedence, and interaction coverage for focus and recovery.
- 2026-08-16: Product review found that the production parser clamps fiber to carbohydrates while the deterministic E2E control preserves the submitted literal. Reopened explicit-value handling and its production-shaped coverage.
- 2026-08-16: The production provider mapper now preserves portion, calories, protein, carbohydrates, fat, and fiber literally (including fiber above carbohydrates). A provider-stub adapter test exercises `parseFoodTextWithAi`, while the deterministic composer scenario passes the submitted provider-shaped payload through the same mapper and is mapped to both browser projects; the backend suite is 77/77 and the desktop composer spec is 14/14.
- 2026-08-16: Closed after the provider-mapper adapter, exact-value preservation, concurrent submission, retry, and focus coverage passed within the consolidated validation: backend 84/84, frontend 118/118, and deterministic Playwright 152/152 (76 desktop Chromium and 76 mobile WebKit), with zero skips, unexpected results, or flaky results, 152 separate videos, and clean artifact verification.
