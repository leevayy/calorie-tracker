# 07 — Navigate and log against another day

**What to build:** Let the user move between calendar days on the dashboard and log food directly against the selected day rather than being restricted to today.

**Blocked by:** 05 — Make the logging composer resilient and keyboard-fast.

**Status:** ready-for-agent

- [ ] The dashboard clearly displays the selected calendar date and provides previous-day and next-day navigation.
- [ ] The currently selected day loads its own meals and totals without losing navigation context.
- [ ] AI submissions and historical-food suggestions are saved to the selected day.
- [ ] Returning to today is available as a direct action when another date is selected.
- [ ] Automated tests cover date boundaries and verify that submissions never leak into the wrong day.
