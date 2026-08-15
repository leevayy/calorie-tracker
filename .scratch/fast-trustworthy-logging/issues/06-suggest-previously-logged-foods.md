# 06 — Suggest previously logged foods while typing

**What to build:** Search the user's previously logged foods as they type and let them instantly log an exact historical configuration without invoking AI. Distinct portions or nutrition values for similarly named foods must remain distinguishable.

**Blocked by:** 05 — Make the logging composer resilient and keyboard-fast.

**Status:** ready-for-human

- [x] Typing in the composer produces matching historical food suggestions with name, portion, calories, and useful usage context.
- [x] Search results distinguish materially different configurations of the same food name.
- [x] Results are ranked using text relevance, usage frequency, and recency.
- [x] Selecting a result immediately logs its stored values to the selected meal and day without an AI request.
- [x] Search remains responsive as the user's food history grows, with automated coverage for matching and ranking.

## Comments

- 2026-08-15: Added debounced, stale-safe historical search backed by a trigram index; ranked exact configurations by relevance, frequency, and recency; and added one-tap reuse with stored nutrition and meal slug, bypassing AI.
