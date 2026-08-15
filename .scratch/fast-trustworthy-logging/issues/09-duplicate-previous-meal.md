# 09 — Duplicate a previous meal

**What to build:** Let the user copy an entire meal from a historical day to the currently selected day in one operation, then correct individual copied foods if necessary.

**Blocked by:** 01 — Log all recognized foods atomically; 07 — Navigate and log against another day; 08 — Open and correct a day from history.

**Status:** ready-for-agent

- [x] A meal in historical day detail provides a duplicate action with a clear destination day and meal.
- [x] Every food in the meal is copied atomically with its stored portion and nutrition values.
- [x] The original historical meal remains unchanged.
- [x] The copied entries can immediately use the established editing and undo interactions.
- [x] Automated tests cover successful duplication and rollback when the copy cannot complete.

## Comments

- 2026-08-15: Added the ownership-scoped `POST /meals/duplicate` transaction and
  explicit history UI destination flow. The source stays unchanged, copied rows
  use the existing edit/delete/Undo path, and success plus induced rollback pass
  in both Playwright projects as part of the 110/110 final run.
