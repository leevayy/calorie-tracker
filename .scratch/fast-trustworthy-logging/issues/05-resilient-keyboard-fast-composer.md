# 05 — Make the logging composer resilient and keyboard-fast

**What to build:** Optimize the food composer for consecutive keyboard-driven logging. The user should see pending work, retain control during failures, and never need to retype a failed submission.

**Blocked by:** 04 — Automatically save AI-recognized foods.

**Status:** ready-for-agent

- [x] Pressing Enter submits the current description and leaves the composer ready for the next entry.
- [x] A pending representation appears in the target meal while parsing and saving are in progress.
- [x] A failed parse or save preserves the exact submitted text and provides a direct retry action.
- [x] Explicit portion, calorie, and nutrient values supplied in the description take precedence over inferred values.
- [x] Automated interaction tests cover consecutive submissions, failure recovery, and focus behavior.

## Comments

- 2026-08-15: Added concurrent keyboard submissions, meal-level parsing/saving rows, stage-aware retry with exact input preservation, explicit-value parser precedence, and interaction coverage for focus and recovery.
