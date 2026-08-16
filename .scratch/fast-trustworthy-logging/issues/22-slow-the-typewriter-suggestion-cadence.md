# 22 — Slow the typewriter suggestion cadence

**What to build:** Keep the intentionally animated composer typewriter, but let each completed food example remain readable for substantially longer so the prompt changes less often and feels calmer.

**Blocked by:** 05 — Make the logging composer resilient and keyboard-fast.

**Priority:** P2

**Status:** ready-for-agent

- [x] The animated typing and deleting behavior remains, and the set of food examples is not removed or replaced with a static placeholder.
- [x] A completed example remains fully visible for at least four seconds and a different example does not begin more frequently than once every seven seconds.
- [x] The longer cadence is expressed through named timing constants and deterministic fake-timer tests rather than timing-sensitive browser assertions.
- [x] User input immediately replaces the animated text, and opening, closing, or submitting the composer does not introduce stale placeholder characters.
- [x] `prefers-reduced-motion` continues to render a stable, non-animated example and the accessible input label never changes with the animation.
- [x] The scenario inventory records the user-visible cadence change and desktop/mobile coverage confirms the stable label and reduced-motion behavior.

## Comments

- 2026-08-16: The typewriter still types, holds, deletes, and rotates the localized examples, now with a named 7,000 ms completed hold. Fake-timer tests prove the four/seven-second bounds and stable reduced-motion output; the deterministic composer scenario covers user text across close/reopen/submit, the fixed accessible label, and reduced motion in both configured browser projects. The frontend suite is 112/112 and the desktop composer spec is 14/14.
