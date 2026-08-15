# 04 — Automatically save AI-recognized foods

**What to build:** Make submitting a food description automatically log every recognized food instead of requiring individual accept or reject actions. After saving, show a compact receipt that gives the user immediate Edit and Undo repair actions.

**Blocked by:** 01 — Log all recognized foods atomically; 02 — Edit a saved food entry; 03 — Move or delete an entry with undo.

**Status:** ready-for-agent

- [ ] Submitting a valid food description parses and logs the complete result without a separate review step.
- [ ] The result uses the currently selected meal and day.
- [ ] A compact confirmation identifies what was added and exposes working Edit and Undo actions.
- [ ] Multi-food results remain a single recoverable submission rather than a series of unrelated saves.
- [ ] The former per-suggestion accept/reject interaction is no longer part of the default flow.
