# 07 — Navigate and log against another day

**What to build:** Let the user move between calendar days on the dashboard and log food directly against the selected day rather than being restricted to today.

**Blocked by:** 05 — Make the logging composer resilient and keyboard-fast.

**Status:** ready-for-human

- [x] The dashboard clearly displays the selected calendar date and provides previous-day and next-day navigation.
- [x] The currently selected day loads its own meals and totals without losing navigation context.
- [x] AI submissions and historical-food suggestions are saved to the selected day.
- [x] Returning to today is available as a direct action when another date is selected.
- [x] Automated tests cover date boundaries and verify that submissions never leak into the wrong day.

## Comments

- 2026-08-15: Added localized date navigation, a direct return-to-today action, selected-day loading and totals, authoritative selected-day logging for AI and reused foods, and stale-response protection during rapid navigation.
