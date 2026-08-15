# 10 — Retire the current coaching experience

**What to build:** Remove the current daily advice experience and its personality controls so the product focuses on fast, correct logging. AI model routing remains an internal implementation concern rather than a user setting.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] The dashboard no longer displays, loads, or regenerates daily advice.
- [x] Settings no longer expose tip-vibe controls or a user-facing AI model selector.
- [x] Food parsing continues to use a server-selected model without requiring a user preference.
- [x] Removing the coaching surface does not affect authentication, logging, daily totals, or history.
- [x] User-facing copy and automated tests no longer describe the retired controls as available features.

## Comments

- 2026-08-15: Removed the daily-tip stack, vibe controls, model preference, and
  retired copy; food parsing now resolves its model on the server. Backend and
  frontend suites pass, and the five retirement/settings scenarios plus the
  unaffected auth/logging/history journeys pass on desktop and mobile (110/110).
