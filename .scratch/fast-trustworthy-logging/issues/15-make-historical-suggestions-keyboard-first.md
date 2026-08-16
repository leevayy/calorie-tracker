# 15 — Make historical suggestions keyboard-first

**What to build:** Let an expert user discover, select, and log historical-food suggestions without leaving the composer keyboard flow, while preserving one-tap pointer and touch behavior.

**Blocked by:** 06 — Suggest previously logged foods while typing.

**Priority:** P1

**Status:** ready-for-agent

- [x] Arrow Down and Arrow Up move a visible active option through the current suggestion list without moving focus away from the composer input.
- [x] Enter immediately logs the active stored configuration without an AI parse request; when no option is active, Enter retains the established natural-language submission behavior.
- [x] Escape dismisses the suggestion list without clearing the user's input.
- [x] The listbox exposes a correct active descendant or equivalent focus model, each option reports its selected state, and pointer hover never leaves accessibility state stale.
- [x] Composer send controls have stable accessible names and every suggestion action has a visible keyboard focus treatment.
- [x] Deterministic desktop and mobile tests cover keyboard selection, AI bypass, pointer selection, dismissal, focus restoration, and stale suggestion responses.

## Comments

- 2026-08-16: Implemented an input-owned listbox focus model with wrapping Arrow navigation, Enter AI bypass, Escape dismissal, synchronized pointer/ARIA state, stable send labeling, and focus-visible option styling. Focused component coverage is included in the green 112/112 frontend suite, and the mapped keyboard, pointer, dismissal, reuse, and stale-response Playwright scenarios target both browser projects in the running complete matrix.
- 2026-08-16: Correlated visible options with the completed store query so stale
  debounce results cannot be selected, added explicit combobox semantics, and
  verified the complete keyboard/pointer/reuse/stale-response set in the final
  75/75 desktop and 75/75 mobile deterministic matrix. The frontend suite now
  passes 118/118.
