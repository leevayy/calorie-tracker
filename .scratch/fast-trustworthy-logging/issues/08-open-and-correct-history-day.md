# 08 — Open and correct a day from history

**What to build:** Make every day in history openable as an itemized daily log. The user can inspect the foods behind a total and correct them with the same editing interactions used on the dashboard.

**Blocked by:** 02 — Edit a saved food entry; 07 — Navigate and log against another day.

**Status:** ready-for-agent

- [x] Selecting a history day opens that calendar day's itemized meals and totals.
- [x] The opened day supports the established edit, move, delete, and undo interactions.
- [x] Corrections immediately update both the day detail and aggregate history values.
- [x] Navigation back to history preserves the user's previous history context.
- [x] Automated tests cover opening a day and observing aggregate changes after a correction.

## Comments

- 2026-08-15: Implemented an itemized history-day detail with shared correction,
  move, soft-delete/Undo, aggregate reconciliation, and scroll-context behavior.
  Unit coverage passes and the final desktop/mobile Playwright matrix passed
  110/110, including all four history-detail scenarios in both projects.
