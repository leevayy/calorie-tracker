# 07 — Localize Aero appearance copy

**What to build:** Add concise functional and atmospheric Aero copy in every
supported locale without editing components or styles.

**Blocked by:** None

**Priority:** P1

**Status:** ready-for-agent

**State:** closed

- [x] Every supported locale defines `settings.aeroMode`,
      `settings.aeroModeHint`, `settings.aeroModeEnabled`, and
      `settings.aeroModeDisabled`.
- [x] Every supported locale defines `aero.tagline`, `aero.authAtmosphere`,
      `aero.todayAtmosphere`, `aero.historyAtmosphere`, and
      `aero.settingsAtmosphere`.
- [x] Functional labels are direct, while atmospheric copy is short, optimistic,
      culturally natural, and centered on openness and freedom.
- [x] Copy avoids dieting shame, medical claims, hard-to-translate idioms, and
      calling the tracker a diary.
- [x] Locale topology is identical across English, Russian, Polish, Tatar, and
      Kazakh, with no accidental English leakage.
- [x] Locale tests pass.

## Exclusive ownership

- `frontend/src/i18n/locales/en.json`
- `frontend/src/i18n/locales/ru.json`
- `frontend/src/i18n/locales/pl.json`
- `frontend/src/i18n/locales/tt.json`
- `frontend/src/i18n/locales/kk.json`
- `frontend/src/i18n/locales.test.ts`

Do not edit components, styles, assets, or E2E coverage.

## Verification

- Run the locale unit tests.
- `npm --prefix frontend test`

## Comments

- 2026-08-21: Created from the completed Frutiger Aero design-tree interview.
- 2026-08-21: Completed. All five locale topologies, nine Aero leaves, placeholder parity, and
  accidental English fallback are enforced; locale tests and the full frontend suite passed.
