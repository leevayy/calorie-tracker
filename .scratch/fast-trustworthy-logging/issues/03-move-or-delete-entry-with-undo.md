# 03 — Move or delete an entry with undo

**What to build:** Extend the saved-food editor so the user can move an entry to another meal or calendar day and recover an accidental deletion through a temporary Undo action.

**Blocked by:** 02 — Edit a saved food entry.

**Status:** ready-for-agent

- [x] The editor can change an entry's meal and calendar day while preserving its nutrition values.
- [x] Moving an entry updates both the source and destination day totals without creating a duplicate.
- [x] Deleting an entry removes it immediately and presents a temporary Undo action.
- [x] Undo restores the complete entry to its original day and meal.
- [x] Automated tests cover moving, deleting, restoring, and ownership boundaries.

## Comments

- 2026-08-15: Implemented move through the correction API, reversible soft deletion, an eight-second Undo action, and ownership/state guards for delete and restore.
