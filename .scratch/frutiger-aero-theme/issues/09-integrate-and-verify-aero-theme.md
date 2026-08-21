# 09 — Integrate and verify the Aero appearance

**What to build:** Merge the eight independent workstreams, resolve their
integration seams without weakening the approved design, and produce final
functional, visual, performance, accessibility, and browser-test evidence.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08

**Priority:** P1

**Status:** ready-for-agent

**State:** closed

- [x] Assets and localization, foundation, shell/Auth, Today, History, and E2E
      work are integrated against the exact contract in `../spec.md`.
- [x] Merge resolution does not duplicate theme state, application behavior,
      responsive state, editors, or composer sessions.
- [x] Standard appearance remains visually and behaviorally unchanged.
- [x] Aero Day/Night is coherent across every maintained state and viewport.
- [x] Initial Aero route transfer remains near the agreed 2 MB target, page
      scenes lazy-load, and fallbacks remain usable.
- [x] Frontend unit tests and the production build pass.
- [x] Relevant Aero Playwright coverage passes in desktop and mobile projects.
- [x] The complete deterministic Playwright suite passes against the real stack.
- [x] Artifact verification passes with one independently reportable video per
      test result.
- [x] Manual QA covers Standard/Aero x Day/Night, reduced motion, keyboard/focus,
      localization, safe areas, the responsive matrix, and overflow.
- [x] Comments record exactly which deterministic desktop, deterministic mobile,
      and live-AI checks ran or did not run; no unrun check is implied to pass.

## Integration sequence

1. Merge stock assets, original artwork, and localization.
2. Merge the appearance engine and shared material system.
3. Merge shell/Auth, Today, and History surface branches.
4. Merge deterministic browser coverage and reconcile only contract-level naming
   differences.
5. Run unit/build checks, focused browser checks, the complete deterministic
   suite, artifact verification, performance checks, and manual visual QA.

After all branches are available, this issue may edit any in-scope frontend,
test, or documentation file strictly to integrate and verify the approved work.
It must preserve unrelated user changes.

## Verification

- `npm --prefix frontend test`
- `npm --prefix frontend run build`
- relevant Aero deterministic desktop/mobile Playwright specs
- complete deterministic Playwright suite
- `npm run e2e:verify-artifacts`

Live-AI checks are not required for a visual-only change unless separately
authorized. They must still be reported as not run when omitted.

## Comments

- 2026-08-21: This is the sole sequential convergence issue; issues 01 through 08
  are intentionally independent and suitable for separate parallel worktrees.
- 2026-08-21: Completed. Frontend 34 files/158 tests passed; production build passed; all 178
  deterministic desktop/mobile Playwright results passed on the corrected frozen tree; artifact
  verification passed with one video per result. Day/Night desktop/mobile visual spot checks and
  asset audits passed. Live-AI was not run because this visual change uses deterministic backend
  controls and does not authorize paid provider calls.
