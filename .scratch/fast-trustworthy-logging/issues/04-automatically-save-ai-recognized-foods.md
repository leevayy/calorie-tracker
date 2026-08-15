# 04 — Automatically save AI-recognized foods

**What to build:** Make submitting a food description automatically log every recognized food instead of requiring individual accept or reject actions. After saving, show a compact receipt that gives the user immediate Edit and Undo repair actions.

**Blocked by:** 01 — Log all recognized foods atomically; 02 — Edit a saved food entry; 03 — Move or delete an entry with undo.

**Status:** ready-for-agent

- [x] Submitting a valid food description parses and logs the complete result without a separate review step.
- [x] The result uses the currently selected meal and day.
- [x] A compact confirmation identifies what was added and exposes working Edit and Undo actions.
- [x] Multi-food results remain a single recoverable submission rather than a series of unrelated saves.
- [x] The former per-suggestion accept/reject interaction is no longer part of the default flow.

## Comments

- 2026-08-15: Replaced suggestion review with automatic atomic persistence. Added grouped receipts with per-entry Edit and transaction-backed Undo for the complete submission.
