# 02 — Edit a saved food entry

**What to build:** Let the user tap an already logged food and correct its name, portion, calories, protein, carbohydrates, fats, or fiber in a compact editor. Corrections must become the persisted source of truth everywhere the entry is displayed.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] Tapping a saved food opens an editor populated with its current values.
- [x] The common fields are easy to reach while detailed nutrients can be edited without overwhelming the initial view.
- [x] Saving valid changes persists them and immediately refreshes the food row, meal totals, daily totals, and history aggregates.
- [x] Invalid values produce field-level feedback without discarding the user's edits.
- [x] Automated tests cover updating an owned entry and rejecting invalid or unauthorized updates.

## Comments

- 2026-08-15: Implemented an ownership-scoped full-entry correction API and compact editor with collapsible nutrition details, field-level validation, and immediate day/history reconciliation.
