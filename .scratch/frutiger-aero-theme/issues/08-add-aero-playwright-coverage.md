# 08 — Add deterministic Aero Playwright coverage

**What to build:** Extend the scenario inventory and deterministic real-browser
suite to cover the optional Aero appearance across every affected maintained
desktop and mobile journey. Do not edit frontend implementation.

**Blocked by:** None

**Priority:** P1

**Status:** ready-for-agent

**State:** closed

- [x] A clean browser starts in Standard appearance.
- [x] Settings toggles Aero independently of light/dark, persists it across
      reload, causes no backend preference request, and avoids a first-paint
      appearance flash.
- [x] Standard appearance continues to render and behave normally.
- [x] Aero Day and Aero Night cover Auth, Today, History, historical detail, and
      Settings on desktop and mobile.
- [x] Logging, suggestion selection, editing, retry, deletion, Undo, History
      navigation, and meal duplication remain operable in Aero.
- [x] Coverage includes 390x844, 900x1024, 1280x720, and 1440x900 plus explicit
      `767/768` resize continuity without resize-triggered application requests.
- [x] Long-locale containment is checked at 320, 390, and 430 CSS pixels.
- [x] Focus, keyboard operation, modal containment, 44px primary targets, safe
      areas, reduced motion, and document overflow have deterministic assertions.
- [x] The scenario inventory maps every new or changed exact test title.
- [x] Deterministic tests use the running frontend/backend and isolated database,
      never mock browser HTTP APIs, and make no paid external AI calls.
- [x] Run reporting preserves one video per result and states desktop, mobile,
      and live-AI checks honestly.

## Exclusive ownership

- `e2e/**`
- `playwright.config.ts`, only if required by the chosen coverage structure
- `docs/testing/playwright-scenarios.md`

Do not edit frontend implementation. Tests may initially be red in this isolated
branch because the implementation branches are intentionally independent; they
must at least compile/list, and final execution belongs to issue 09.

## Verification

- `npm run e2e:list`
- Run any coverage that can execute meaningfully against the isolated branch and
  explicitly report expected implementation-dependent failures.

## Comments

- 2026-08-21: Created from the completed Frutiger Aero design-tree interview.
- 2026-08-21: Completed. Six scenarios produced 12 passing Aero results across desktop Chromium
  and mobile WebKit, including first paint, routes, workflows, responsive seams, locales, focus,
  target sizes, safe areas, and reduced motion. Artifact verification passed.
