# 13 — Make AI correction the primary food-entry editor

**What to build:** When a user taps a saved food entry, open an AI-first correction editor whose primary control is a natural-language instruction such as “double the calories.” Use the stored entry as structured context, apply coherent changes to the complete nutrition record, and keep the existing raw-field editor available through a separate secondary button.

**Blocked by:** 02 — Edit a saved food entry; 03 — Move or delete an entry with undo.

**Status:** ready-for-agent

- [x] Tapping a saved food opens the AI correction mode by default, with a clearly visible instruction input for describing what should change.
- [x] The current saved entry is supplied to the correction flow as structured context; the AI does not have to reconstruct the entry from display text.
- [x] AI output is schema-validated and produces a complete editable draft before anything is persisted. The user can inspect the proposed result and use the existing Save action to commit it.
- [x] Proportional instructions keep nutrition internally consistent. For example, “double the calories” exactly doubles calories, protein, carbohydrates, fats, and fiber from their stored values rather than independently inventing new estimates. Portion is changed only when the instruction implies a serving or quantity change.
- [x] Deterministic arithmetic is applied by application code after the AI identifies an operation such as scaling; the model is not trusted to calculate each resulting number independently.
- [x] Date and meal remain visible, explicit selectors in the primary AI editor so an entry can still be moved without describing the move to the AI.
- [x] A separate secondary “Edit fields” control opens the existing structured editor for name, portion, calories, protein, carbohydrates, fats, and fiber as a fallback.
- [x] AI and structured modes edit the same draft, and switching modes does not discard proposed or manually entered changes.
- [x] An invalid, ambiguous, or failed AI correction leaves the persisted entry unchanged, preserves the user's instruction for retry, and offers the structured editor fallback.
- [x] Saving through either mode updates the food row, source and destination meal/day totals, and history aggregates exactly once, using the existing ownership-scoped update path.
- [x] Automated tests cover the default AI-first opening state, exact proportional scaling, date and meal selectors, switching to structured fields, validation/failure recovery, persistence, aggregate reconciliation, and authorization boundaries.

## Comments

- 2026-08-15: Added from product feedback. “Separate key” is interpreted as a secondary “Edit fields” button; the existing structured editor remains the recovery path rather than the default experience.
- 2026-08-15: Implemented the ownership-scoped correction proposal endpoint and
  AI-first shared draft, with deterministic application scaling, explicit schedule
  selectors, structured fallback, clear-portion handling, and save-only persistence.
  Backend/frontend tests pass and all twelve correction journeys passed in both
  browser projects within the final 110/110 run.
