# 10 — Retire the current coaching experience

**What to build:** Remove the current daily advice experience and its personality controls so the product focuses on fast, correct logging. AI model routing remains an internal implementation concern rather than a user setting.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The dashboard no longer displays, loads, or regenerates daily advice.
- [ ] Settings no longer expose tip-vibe controls or a user-facing AI model selector.
- [ ] Food parsing continues to use a server-selected model without requiring a user preference.
- [ ] Removing the coaching surface does not affect authentication, logging, daily totals, or history.
- [ ] User-facing copy and automated tests no longer describe the retired controls as available features.
