# 06 — Suggest previously logged foods while typing

**What to build:** Search the user's previously logged foods as they type and let them instantly log an exact historical configuration without invoking AI. Distinct portions or nutrition values for similarly named foods remain distinguishable when they have different meal slugs or no meal slug; configurations sharing a canonical non-empty slug follow ticket 23's single-representative rule.

**Blocked by:** 05 — Make the logging composer resilient and keyboard-fast.

**Priority:** P1

**Status:** ready-for-agent

**State:** closed

- [x] Typing in the composer produces matching historical food suggestions with name, portion, calories, and useful usage context.
- [x] Search results visibly distinguish materially different configurations of the same food name, including macro-only differences, when their meal slugs differ or are absent; configurations sharing a canonical non-empty slug merge under ticket 23.
- [x] Results are ranked using text relevance, usage frequency, and recency.
- [x] Selecting a result immediately logs its stored values to the selected meal and day without an AI request.
- [x] Search remains responsive as the user's food history grows, with automated coverage that measures user-visible suggestion latency and verifies matching and ranking.

## Comments

- 2026-08-15: Added debounced, stale-safe historical search backed by a trigram index; ranked exact configurations by relevance, frequency, and recency; and added one-tap reuse with stored nutrition and meal slug, bypassing AI.
- 2026-08-16: Product review found that configurations differing only in macros are indistinguishable in the current suggestion row and that the existing scale test has no user-visible latency assertion. Reopened those criteria without changing the established AI-bypass flow.
- 2026-08-16: Historical suggestion rows now display protein, carbohydrate, fat, and fiber values, and deterministic component/browser coverage distinguishes otherwise identical name/portion/calorie configurations by macros. The large-history latency criterion remains open because its 1,001-entry browser seed currently exceeds the E2E control's 500-entry-per-user validation limit.
- 2026-08-16: Raised the E2E seed boundary to a still-bounded 2,000 entries, added route-level coverage for accepting 1,001 and rejecting 2,001 entries, and passed the 1,001-entry user-visible latency check under 1.25 seconds in both desktop Chromium and mobile WebKit.
- 2026-08-16: Ticket 23 explicitly supersedes criterion 06.2 only when materially different configurations share the same canonical non-empty meal slug. Updated the criterion and deterministic browser fixture honestly: different-slug or slugless configurations remain distinct, while shared-slug configurations expose one highest-ranked representative. Coverage is `keeps same-name historical configurations distinct when their slugs differ` plus ticket 23's merge scenario.
- 2026-08-16: The reconciled Issue 06/23 browser pair passed 4/4 across desktop Chromium and mobile WebKit with four separate videos retained; the standalone artifact verifier also passed.
- 2026-08-16: Closed after the 1,001-entry latency path, distinct-slug and slugless configurations, ticket 23 shared-slug merge rule, ranking, and AI-bypass coverage passed within the consolidated validation: backend 84/84, frontend 118/118, and deterministic Playwright 152/152 (76 desktop Chromium and 76 mobile WebKit), with zero skips, unexpected results, or flaky results, 152 separate videos, and clean artifact verification.
