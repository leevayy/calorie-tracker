# 04 — Redesign the shell, navigation, and Auth surface

**What to build:** Apply the optional Aero world to the responsive application
shell, navigation, and authentication journey while preserving the routing and
mounted/inert behavior model.

**Blocked by:** None

**Priority:** P1

**Status:** ready-for-agent

**State:** closed

- [x] Desktop Aero resembles a glossy personal wellness appliance opening onto
      an optimistic landscape.
- [x] Mobile navigation evokes tactile phone-era controls without losing route
      state, safe areas, touch targets, or accessible labels.
- [x] Auth provides a complete establishing scene and coherent default,
      validation, loading, error, sign-up, and sign-in states.
- [x] Aero may change navigation presentation and feedback, but the same routes,
      mounted page set, inert state, and responsive session continuity remain.
- [x] Decorative layers never intercept swipes, clicks, focus, drawers, or
      scrolling.
- [x] Aero Day, Aero Night, reduced motion, long labels, and the `767/768` seam
      are handled intentionally.
- [x] Standard appearance remains visually and behaviorally unchanged.
- [x] Owned unit tests and the frontend production build pass.

## Exclusive ownership

- `frontend/src/app/layout/AppTabShell.tsx`
- `frontend/src/app/layout/AppTabShell.test.ts`
- `frontend/src/app/layout/AppTabNav.tsx`
- `frontend/src/app/pages/AuthPage.tsx`
- new unit tests specifically for these owned components
- `frontend/src/styles/aero/shell-auth.css`

Reference fixed assets from `../spec.md`; their absence on this isolated branch
does not block implementation. Import the surface stylesheet from an owned file.
Do not edit the provider, Settings, shared DS primitives, locale files, Today,
History, assets, or E2E coverage.

## Verification

- Run the directly affected unit tests.
- `npm --prefix frontend run build`
- Manually inspect Standard/Aero and Day/Night at 390x844, 767x900, 768x900,
  1280x720, and 1440x900.

## Comments

- 2026-08-21: Created from the completed Frutiger Aero design-tree interview.
- 2026-08-21: Completed. Shell/Auth tests passed, the production build passed, Day/Night desktop
  and mobile visuals were inspected, and the complete deterministic desktop/mobile suite passed.
