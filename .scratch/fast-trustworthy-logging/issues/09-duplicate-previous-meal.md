# 09 — Duplicate a previous meal

**What to build:** Let the user copy an entire meal from a historical day to the currently selected day in one operation, then correct individual copied foods if necessary.

**Blocked by:** 01 — Log all recognized foods atomically; 07 — Navigate and log against another day; 08 — Open and correct a day from history.

**Status:** ready-for-agent

- [ ] A meal in historical day detail provides a duplicate action with a clear destination day and meal.
- [ ] Every food in the meal is copied atomically with its stored portion and nutrition values.
- [ ] The original historical meal remains unchanged.
- [ ] The copied entries can immediately use the established editing and undo interactions.
- [ ] Automated tests cover successful duplication and rollback when the copy cannot complete.
