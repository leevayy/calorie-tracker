# 01 — Build the appearance engine and Aero material system

**What to build:** Add the local optional-appearance state, Settings control,
global Aero Day/Night tokens, typography, and shared design-system treatments
defined in `../spec.md`.

**Blocked by:** None

**Priority:** P1

**Status:** ready-for-agent

**State:** closed

- [x] Appearance accepts only `standard` and `aero`, defaults to `standard`, and
      persists under the local `appearance` key without a backend request.
- [x] The root `data-appearance` attribute is correct before first paint and
      invalid stored data falls back safely.
- [x] Appearance remains independent of the existing light/dark setting, with
      intentional Aero Day and Aero Night tokens.
- [x] Settings exposes a distinct accessible Frutiger Aero switch with accurate
      checked and enabled/disabled state.
- [x] Shared buttons, cards, inputs, badges, and text receive original glass,
      chrome, gel, bevel, focus, disabled, loading, success, warning, and error
      treatments only in Aero.
- [x] An open-licensed display face and readable humanist fallback are bundled
      locally with their license.
- [x] The development design-system page documents both Aero color modes and all
      important component states.
- [x] Standard appearance remains unchanged and reduced motion is honored.
- [x] Owned unit tests and the frontend production build pass.

## Exclusive ownership

- `frontend/src/app/components/ThemeProvider.tsx` and its tests
- `frontend/src/app/pages/SettingsPage.tsx`
- `frontend/src/app/pages/SettingsPage.test.ts`
- `frontend/src/app/pages/DesignSystemPage.tsx`
- `frontend/src/app/components/ds/**`
- `frontend/src/styles/theme.css`
- `frontend/src/styles/fonts.css`
- `frontend/src/styles/index.css`
- `frontend/src/styles/aero/foundation.css`
- `frontend/public/aero/fonts/**`

Do not edit page layouts, page-specific Aero styles, locale JSON files, E2E
specifications, or photographic/original-art asset directories owned by other
issues.

## Verification

- `npm --prefix frontend test`
- `npm --prefix frontend run build`

## Comments

- 2026-08-21: Created from the completed Frutiger Aero design-tree interview.
- 2026-08-21: Completed. Appearance bootstrap/provider persistence, independent color mode,
  Settings switch, shared Aero materials, bundled Comfortaa/OFL, reduced motion, focused tests,
  full frontend tests, production build, and desktop/mobile visual checks passed.
