# 06 — Suggest previously logged foods while typing

**What to build:** Search the user's previously logged foods as they type and let them instantly log an exact historical configuration without invoking AI. Distinct portions or nutrition values for similarly named foods must remain distinguishable.

**Blocked by:** 05 — Make the logging composer resilient and keyboard-fast.

**Priority:** P1

**Status:** ready-for-agent

- [x] Typing in the composer produces matching historical food suggestions with name, portion, calories, and useful usage context.
- [x] Search results visibly distinguish materially different configurations of the same food name, including configurations that differ only in nutrient values.
- [x] Results are ranked using text relevance, usage frequency, and recency.
- [x] Selecting a result immediately logs its stored values to the selected meal and day without an AI request.
- [x] Search remains responsive as the user's food history grows, with automated coverage that measures user-visible suggestion latency and verifies matching and ranking.

## Comments

- 2026-08-15: Added debounced, stale-safe historical search backed by a trigram index; ranked exact configurations by relevance, frequency, and recency; and added one-tap reuse with stored nutrition and meal slug, bypassing AI.
- 2026-08-16: Product review found that configurations differing only in macros are indistinguishable in the current suggestion row and that the existing scale test has no user-visible latency assertion. Reopened those criteria without changing the established AI-bypass flow.
- 2026-08-16: Historical suggestion rows now display protein, carbohydrate, fat, and fiber values, and deterministic component/browser coverage distinguishes otherwise identical name/portion/calorie configurations by macros. The large-history latency criterion remains open because its 1,001-entry browser seed currently exceeds the E2E control's 500-entry-per-user validation limit.
- 2026-08-16: Raised the E2E seed boundary to a still-bounded 2,000 entries, added route-level coverage for accepting 1,001 and rejecting 2,001 entries, and passed the 1,001-entry user-visible latency check under 1.25 seconds in both desktop Chromium and mobile WebKit.
