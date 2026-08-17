# Playwright user-scenario inventory

This is the canonical browser-coverage map for the maintained web application.
Each acceptance criterion from the maintained local issues has its own row. Test
titles are contracts: when a scenario is renamed or split, update this inventory
in the same change.

Coverage columns mean:

- **D** — deterministic `desktop-chromium` project.
- **M** — deterministic `mobile-webkit` project.
- **L** — opt-in `live-ai-chromium` project; `—` means intentionally covered by
  deterministic backend controls rather than a paid provider call.
- **Yes** identifies required/planned coverage, not evidence that a particular
  run was executed. Run evidence belongs in the change report.

All deterministic scenarios use the running frontend and backend with an
isolated PostgreSQL database. They do not mock application HTTP APIs in the
browser. Tests that induce AI or persistence failures use test-only backend
controls.

## Maintained baseline journeys

| Area | Planned spec and exact test title | D | M | L |
| --- | --- | :---: | :---: | :---: |
| Authentication lifecycle and visual-secret prevention | `e2e/auth.spec.ts` — `signs up, signs in, persists the session, and signs out` uses the public synthetic identity and proves password controls are masked before filling | Yes | Yes | — |
| Authentication validation | `e2e/auth.spec.ts` — `shows validation and rejects invalid credentials without losing input` | Yes | Yes | — |
| Supported profile/settings | `e2e/settings.spec.ts` — `updates supported profile fields and language after reload` | Yes | Yes | — |
| Concise English UI and compact-editor consistency | `e2e/ui-consistency.spec.ts` — `keeps English core screens contained and typographically consistent` | Yes | Yes | — |
| Idiomatic Russian UI and compact-editor consistency | `e2e/ui-consistency.spec.ts` — `keeps Russian core screens contained and typographically consistent` | Yes | Yes | — |
| Dashboard visual consistency | Both localized `e2e/ui-consistency.spec.ts` scenarios verify the calorie ring has no slice outlines | Yes | Yes | — |
| Localized composer hints | `e2e/composer.spec.ts` — `rotates concise food examples without changing the input label`; both localized `e2e/ui-consistency.spec.ts` scenarios | Yes | Yes | — |
| Entry ownership | `e2e/authorization.spec.ts` — `cannot read, edit, delete, or restore another user's food entry` | Yes | Yes | — |
| Historical ownership | `e2e/authorization.spec.ts` — `cannot open or duplicate another user's historical meal` | Yes | Yes | — |

## Issue 01 — Log all recognized foods atomically

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 01.1 | One action logs every food from a one- or multi-food parse to the selected meal/day. | `e2e/logging.spec.ts` — `logs every recognized food atomically and persists totals after reload`; `e2e/live-ai.live.spec.ts` — `@live-ai parses and saves a real multi-food description` | Yes | Yes | Yes |
| 01.2 | The group is created together and totals update once after success. | `e2e/logging.spec.ts` — `logs every recognized food atomically and persists totals after reload` | Yes | Yes | — |
| 01.3 | Any failed entry rolls back the complete group and leaves it retryable. | `e2e/logging.spec.ts` — `rolls back the complete recognized group and offers retry` | Yes | Yes | — |
| 01.4 | Automated coverage proves multi-food success and rollback. | The two `e2e/logging.spec.ts` scenarios above, with persistence verified after reload | Yes | Yes | — |

## Issue 02 — Edit a saved food entry

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 02.1 | Tapping a saved food opens an editor populated from persisted values. | `e2e/ai-correction.spec.ts` — `opens a saved entry in the AI-first editor with its persisted draft` | Yes | Yes | — |
| 02.2 | The initial editor uses the record name as its title, shows calories and macros as a compact subtitle, keeps instruction spacing balanced, and uses concise Save/Delete actions; long names and macro rows wrap; manual fields, nutrients, and schedule use progressive disclosure; and footer actions remain reachable while the body scrolls. | `e2e/ai-correction.spec.ts` — `switches to Edit fields and exposes detailed nutrients without losing the draft`; `e2e/ui-consistency.spec.ts` — `keeps English core screens contained and typographically consistent`; `keeps Russian core screens contained and typographically consistent` | Yes | Yes | — |
| 02.3 | Valid changes persist and refresh the row, meal/day totals, and history aggregate. | `e2e/ai-correction.spec.ts` — `saves a structured correction and reconciles every aggregate after reload` | Yes | Yes | — |
| 02.4 | Invalid values show field-level feedback without losing edits. | `e2e/ai-correction.spec.ts` — `keeps invalid structured edits with field-level feedback` | Yes | Yes | — |
| 02.5 | Owned updates succeed; unauthorized updates are rejected. | `e2e/ai-correction.spec.ts` — `saves a structured correction and reconciles every aggregate after reload`; `e2e/authorization.spec.ts` — `cannot read, edit, delete, or restore another user's food entry` | Yes | Yes | — |

## Issue 03 — Move or delete an entry with undo

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 03.1 | The editor moves an entry to another meal/day without changing nutrition. | `e2e/entry-mutations.spec.ts` — `moves an entry to another meal and day without changing nutrition` | Yes | Yes | — |
| 03.2 | A move updates source and destination totals without duplication. | `e2e/entry-mutations.spec.ts` — `reconciles source and destination totals once after a move and reload` | Yes | Yes | — |
| 03.3 | Delete removes immediately and presents temporary Undo. | `e2e/entry-mutations.spec.ts` — `deletes a saved entry and offers temporary Undo` | Yes | Yes | — |
| 03.4 | Undo restores the complete entry to its original day and meal. | `e2e/entry-mutations.spec.ts` — `restores the complete deleted entry to its original day and meal` | Yes | Yes | — |
| 03.5 | Moving, deleting, restoring, and ownership boundaries are covered. | All four `e2e/entry-mutations.spec.ts` scenarios; `e2e/authorization.spec.ts` — `cannot read, edit, delete, or restore another user's food entry` | Yes | Yes | — |

## Issue 04 — Automatically save AI-recognized foods

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 04.1 | Valid descriptions parse and save without a separate review step. | `e2e/logging.spec.ts` — `automatically saves recognized foods without a review step`; `e2e/live-ai.live.spec.ts` — `@live-ai parses and saves a real multi-food description` | Yes | Yes | Yes |
| 04.2 | Automatic results use the currently selected meal and day. | `e2e/logging.spec.ts` — `automatically saves recognized foods to the selected meal and day` | Yes | Yes | — |
| 04.3 | A compact receipt identifies additions and provides working Edit and Undo. | `e2e/logging.spec.ts` — `shows the grouped receipt and repairs an addition with Edit and Undo` | Yes | Yes | — |
| 04.4 | Multi-food results remain one recoverable submission. | `e2e/logging.spec.ts` — `undoes one multi-food submission as a group` | Yes | Yes | — |
| 04.5 | Per-suggestion accept/reject is absent from the default flow. | `e2e/logging.spec.ts` — `automatically saves recognized foods without a review step` | Yes | Yes | — |

## Issue 05 — Resilient keyboard-fast composer

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 05.1 | The empty composer rotates concise localized examples without changing its stable accessible label; Enter submits and leaves it ready for another entry. | `e2e/composer.spec.ts` — `rotates concise food examples without changing the input label`; `submits consecutive entries with Enter and restores composer focus` | Yes | Yes | — |
| 05.2 | A pending row appears in the target meal during parse/save. | `e2e/composer.spec.ts` — `shows parsing and saving rows in the target meal` | Yes | Yes | — |
| 05.3 | Parse/save failure preserves exact text and offers direct retry. | `e2e/composer.spec.ts` — `preserves the exact failed submission and retries from the failed stage` | Yes | Yes | — |
| 05.4 | Explicit portion/calorie/nutrient values override inference without post-provider normalization. | `backend/src/services/aiExplicitNutrition.test.ts` — `preserves every explicit nutrition literal returned by the provider`; `e2e/composer.spec.ts` — `honors explicit portion and nutrition values over inference` sends its deterministic provider payload through the production response mapper | Yes | Yes | — |
| 05.5 | Consecutive submission, recovery, focus, and production-path explicit nutrition behavior are covered. | `e2e/composer.spec.ts` — `submits consecutive entries with Enter and restores composer focus`; `preserves the exact failed submission and retries from the failed stage`; `honors explicit portion and nutrition values over inference`; production adapter test above | Yes | Yes | — |

## Issue 06 — Suggest previously logged foods

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 06.1 | Typing shows historical matches with name, portion, calories, and usage context. | `e2e/suggestions.spec.ts` — `suggests historical foods with nutrition and usage context` | Yes | Yes | — |
| 06.2 | Same-name foods with materially different configurations remain visibly distinct, including macro-only differences, when their slugs differ or are absent; shared non-empty slugs merge under Issue 23. | `e2e/suggestions.spec.ts` — `keeps same-name historical configurations distinct when their slugs differ`; Issue 23 coverage below | Yes | Yes | — |
| 06.3 | Ranking reflects relevance, frequency, and recency. | `e2e/suggestions.spec.ts` — `ranks historical suggestions by relevance frequency and recency` | Yes | Yes | — |
| 06.4 | Selecting a result logs stored values to selected meal/day without AI. | `e2e/suggestions.spec.ts` — `reuses a stored suggestion on the selected day without an AI request` | Yes | Yes | — |
| 06.5 | Search stays responsive as history grows and matching/ranking are covered. | `e2e/suggestions.spec.ts` — `shows a matching large-history result within the user-visible latency budget`; `debounces a large history and ignores stale suggestion responses` forces the older response to arrive after the newer response through a one-shot backend delay | Yes | Yes | — |

## Issue 07 — Navigate and log another day

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 07.1 | Dashboard labels the selected date, provides previous/next navigation, and keeps the selected date visually separate from the return-to-today action. | `e2e/date-navigation.spec.ts` — `navigates previous and next dates and labels the selected day` | Yes | Yes | — |
| 07.2 | Selected-day meals/totals load without losing navigation context. | `e2e/date-navigation.spec.ts` — `keeps the selected day and its totals while navigating` | Yes | Yes | — |
| 07.3 | AI submissions and historical suggestions save only to the selected day. | `e2e/date-navigation.spec.ts` — `logs AI and historical suggestions into the selected day only`; `e2e/live-ai.live.spec.ts` — `@live-ai parses and saves a real multi-food description` | Yes | Yes | Yes |
| 07.4 | A direct, concise Today action is available off today. | `e2e/date-navigation.spec.ts` — `returns directly to today from another date` | Yes | Yes | — |
| 07.5 | Date-boundary tests prove submissions never leak to another day. | `e2e/date-navigation.spec.ts` — `does not leak submissions across calendar-day boundaries` | Yes | Yes | — |

## Issue 08 — Open and correct a history day

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 08.1 | Selecting a history day opens localized meal records and totals for that date without calling the tracker a diary. | `e2e/history.spec.ts` — `opens a history day with itemized meals and totals`; both localized `e2e/ui-consistency.spec.ts` scenarios | Yes | Yes | — |
| 08.2 | History detail supports edit, move, delete, and Undo. | `e2e/history.spec.ts` — `edits moves deletes and undoes from history detail` | Yes | Yes | — |
| 08.3 | Corrections update the detail and aggregate history immediately. | `e2e/history.spec.ts` — `reconciles history detail and aggregate after a correction` | Yes | Yes | — |
| 08.4 | Returning to history preserves the previous history context. | `e2e/history.spec.ts` — `returns to the same history scroll context` | Yes | Yes | — |
| 08.5 | Opening and aggregate correction are covered. | `e2e/history.spec.ts` — `opens a history day with itemized meals and totals`; `reconciles history detail and aggregate after a correction` | Yes | Yes | — |

## Issue 09 — Duplicate a previous meal

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 09.1 | Historical meal detail consistently uses duplicate terminology and has explicit destination date/meal controls. | `e2e/meal-duplication.spec.ts` — `chooses an explicit destination for a historical meal`; both localized `e2e/ui-consistency.spec.ts` scenarios | Yes | Yes | — |
| 09.2 | Every food is copied atomically with stored portion/nutrition. | `e2e/meal-duplication.spec.ts` — `duplicates every food atomically with stored nutrition` | Yes | Yes | — |
| 09.3 | The source historical meal remains unchanged. | `e2e/meal-duplication.spec.ts` — `keeps the source meal unchanged after duplication and reload` | Yes | Yes | — |
| 09.4 | Copied entries immediately support established edit and Undo interactions. | `e2e/meal-duplication.spec.ts` — `edits a copied entry and undoes its deletion` | Yes | Yes | — |
| 09.5 | Success and atomic rollback are covered. | `e2e/meal-duplication.spec.ts` — `duplicates every food atomically with stored nutrition`; `rolls back a failed historical meal duplication` | Yes | Yes | — |

## Issue 10 — Retire coaching

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 10.1 | Dashboard no longer displays, loads, or regenerates daily advice. | `e2e/settings.spec.ts` — `does not render or request retired daily advice` | Yes | Yes | — |
| 10.2 | Settings expose neither tip-vibe controls nor a user-facing AI model selector. | `e2e/settings.spec.ts` — `shows no retired coaching or model controls` | Yes | Yes | — |
| 10.3 | Parsing uses a server-selected model without a user preference. | `e2e/logging.spec.ts` — `parses food with the server-selected model and no client preference`; `e2e/live-ai.live.spec.ts` — `@live-ai parses and saves a real multi-food description` | Yes | Yes | Yes |
| 10.4 | Coaching removal does not affect auth, logging, totals, or history. | `e2e/settings.spec.ts` — `keeps auth logging totals and history working without coaching` | Yes | Yes | — |
| 10.5 | User copy and tests no longer describe retired controls as available. | `e2e/settings.spec.ts` — `contains no retired coaching copy or controls` | Yes | Yes | — |

## Issue 12 — Playwright end-to-end coverage and agent rules

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 12.1 | The production-shaped frontend, real backend, disposable PostgreSQL database, and supported desktop/mobile projects run without browser API mocks. | `playwright.config.ts`; `scripts/e2e.mjs`; all deterministic `e2e/*.spec.ts` journeys | Yes | Yes | — |
| 12.2 | Setup resets an isolated synthetic user and never relies on personal data, ordering, or previous-run state. | `e2e/support/fixtures.ts`; backend E2E controls; every deterministic test fixture reset | Yes | Yes | — |
| 12.3 | The scenario inventory maps maintained features and issue acceptance criteria to exact test titles. | This inventory and its issue tables | Yes | Yes | Yes |
| 12.4 | Core success, validation, empty, loading, retry, and recoverable-failure states are deterministic and use test-only controls. | The Required state-shape coverage table below and its mapped specs | Yes | Yes | — |
| 12.5 | Separately tagged live-provider journeys remain opt-in and do not make the deterministic suite paid or flaky. | `e2e/live-ai.live.spec.ts` — both `@live-ai` journeys; the `live-ai-chromium` project gate | — | — | Yes |
| 12.6 | Assertions prove persistence by reload/revisit rather than immediate DOM state alone. | Persistence scenarios mapped throughout issues 01–09, 13, and 18 | Yes | Yes | Yes |
| 12.7 | Reproducible commands install browsers, prepare the stack, run deterministic/live suites, and retain one video per result plus failure diagnostics. | `package.json`; `playwright.config.ts`; `scripts/e2e.mjs` | Yes | Yes | Yes |
| 12.8 | Ignored credentials and retained artifacts are demonstrably safe before upload. | `scripts/e2e-runner.test.mjs` — `keeps configured secrets out of the browser test environment`; `scripts/e2e-artifacts.test.mjs` — `quarantines plain and compressed artifacts containing a credential`; `streams large artifact files in bounded chunks and matches across chunk boundaries`; `detects a derived JWT that spans many small streaming chunks`; `fails closed on an oversized dotted token component without buffering it whole`; `quarantines a ZIP whose declared entry exceeds the bounded inspection policy`; `quarantines derived and opaque tokens while preserving public E2E handles`; `scans and removes unsafe managed output despite test and cleanup failures`; `.github/workflows/e2e.yml` standalone gated verification | Yes | Yes | Yes |
| 12.9 | Agent rules require inventory and deterministic coverage for user-visible behavior and honest run reporting. | `AGENTS.md` Playwright system-test rules | Yes | Yes | — |
| 12.10 | CI starts clean deterministic projects, retains verified failure artifacts, and gates live AI explicitly. | `.github/workflows/e2e.yml` deterministic and live-AI jobs | Yes | Yes | Yes |
| 12.11 | Setup and troubleshooting documentation is reproducible for contributors and agents. | `docs/testing/playwright.md` | Yes | Yes | Yes |
| 12.12 | Complete deterministic projects retain exactly one independently reportable video per result. | `playwright.config.ts` (`video: "on"`); `scripts/e2e-artifacts.test.mjs` — `resets every managed result target without deleting artifact-root siblings` | Yes | Yes | — |
| 12.13 | Only the active tab/dialog state is exposed, focus enters and remains cyclically contained in the dialog, modal background dashboard/navigation controls leave the accessibility tree, and composer status is not exposed twice. | `frontend/src/app/layout/AppTabShell.test.ts` — `exposes only the route's active tab panel`; `frontend/src/app/components/FoodEntryEditor.test.ts` — `uses a mobile sheet, focuses a non-text control, and progressively reveals the schedule`; `e2e/composer.spec.ts` — `rotates concise food examples without changing the input label`; `shows parsing and saving rows in the target meal`; `edits and resubmits a failed description as a new parse attempt`; `e2e/logging.spec.ts` — `shows the grouped receipt and repairs an addition with Edit and Undo` | Yes | Yes | — |

## Issue 13 — AI correction is the primary entry editor

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 13.1 | Tapping a saved food opens a concise AI correction state titled with the record name and a calories/macros subtitle, with localized Preview/Превью copy, a well-spaced instruction input, a collapsed schedule summary, and no result card before preview. | `e2e/ai-correction.spec.ts` — `opens AI correction by default for a saved entry`; `e2e/ui-consistency.spec.ts` — `keeps English core screens contained and typographically consistent`; `keeps Russian core screens contained and typographically consistent`; `e2e/live-ai.live.spec.ts` — `@live-ai proposes and saves a correction from stored entry context` | Yes | Yes | Yes |
| 13.2 | The correction request uses the stored entry as structured context. | `e2e/ai-correction.spec.ts` — `uses the stored structured entry as correction context`; `e2e/live-ai.live.spec.ts` — `@live-ai proposes and saves a correction from stored entry context` | Yes | Yes | Yes |
| 13.3 | Schema-validated AI output becomes a complete inspectable draft before persistence. | `e2e/ai-correction.spec.ts` — `validates a complete AI draft before Save persists it`; both localized `e2e/ui-consistency.spec.ts` scenarios; `e2e/live-ai.live.spec.ts` — `@live-ai proposes and saves a correction from stored entry context` | Yes | Yes | Yes |
| 13.4 | Proportional instructions scale calories and all nutrients exactly; portion changes only when implied. | `e2e/ai-correction.spec.ts` — `scales calories and every nutrient exactly for a proportional instruction`; both localized `e2e/ui-consistency.spec.ts` scenarios | Yes | Yes | — |
| 13.5 | Application code performs deterministic arithmetic after operation identification. | `e2e/ai-correction.spec.ts` — `scales calories and every nutrient exactly for a proportional instruction` | Yes | Yes | — |
| 13.6 | Date and meal remain explicit selectors behind a compact schedule summary shared by both modes. | `e2e/ai-correction.spec.ts` — `moves the AI correction draft with explicit date and meal selectors`; both localized `e2e/ui-consistency.spec.ts` scenarios | Yes | Yes | — |
| 13.7 | A secondary Edit fields control opens the structured fallback, with nutrition and schedule rows expanding on demand and fixed footer actions remaining reachable. | `e2e/ai-correction.spec.ts` — `switches to Edit fields and exposes detailed nutrients without losing the draft`; both localized `e2e/ui-consistency.spec.ts` scenarios | Yes | Yes | — |
| 13.8 | AI and structured modes share one draft without discarding changes. | `e2e/ai-correction.spec.ts` — `shares one correction draft while switching AI and structured modes` | Yes | Yes | — |
| 13.9 | Invalid/ambiguous/failed AI leaves persistence unchanged, preserves instruction, and offers fallback. | `e2e/ai-correction.spec.ts` — `preserves the instruction and persisted entry after a failed AI correction` | Yes | Yes | — |
| 13.10 | Either mode updates row, source/destination totals, and history exactly once through owned update. | `e2e/ai-correction.spec.ts` — `saves either correction mode exactly once and reconciles every aggregate`; `e2e/authorization.spec.ts` — `cannot read, edit, delete, or restore another user's food entry` | Yes | Yes | — |
| 13.11 | Default state, scaling, selectors, switching, recovery, persistence, aggregates, and authorization are automated. | All `e2e/ai-correction.spec.ts` scenarios above; `e2e/authorization.spec.ts` ownership scenario; live correction smoke | Yes | Yes | Yes |

## Issue 14 — Keep logging receipts compact without hiding prior results

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 14.1 | Every receipt in the current burst remains reachable instead of being reduced to the latest result. | `e2e/composer.spec.ts` — `keeps a long logging burst compact while suggestions and every receipt remain reachable` | Yes | Yes | — |
| 14.2 | Matching historical suggestions stay directly below the input and visible without vertical scrolling after at least ten successes. | `e2e/composer.spec.ts` — `keeps a long logging burst compact while suggestions and every receipt remain reachable` | Yes | Yes | — |
| 14.3 | The receipt activity has bounded height and communicates logged group and food counts without overwhelming the composer. | `e2e/composer.spec.ts` — `keeps a long logging burst compact while suggestions and every receipt remain reachable` | Yes | Yes | — |
| 14.4 | The appropriate Edit and Undo actions remain available, and receipt dates stay explicit after dashboard date navigation. | `e2e/composer.spec.ts` — `operates compact receipt Edit and Undo after a selected-day change` | Yes | Yes | — |
| 14.5 | The chosen vertical collapsible design introduces no horizontal gesture conflict, and receipts remain operable by keyboard and assistive technology. | `e2e/composer.spec.ts` — `operates compact receipt Edit and Undo after a selected-day change` | Yes | Yes | — |
| 14.6 | Long-burst compaction, suggestion visibility, receipt navigation, Edit, Undo, and date changes have deterministic coverage. | Both Issue 14 `e2e/composer.spec.ts` scenarios above | Yes | Yes | — |

## Issue 15 — Historical suggestions are keyboard-first

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 15.1 | Arrow Down/Up moves the visible active option while focus remains in the composer input. | `e2e/suggestions.spec.ts` — `selects an active historical suggestion with arrows and Enter without AI` | Yes | Yes | — |
| 15.2 | Enter logs the active stored configuration without AI; with no active option it retains natural-language submission. | `e2e/suggestions.spec.ts` — `selects an active historical suggestion with arrows and Enter without AI`; `e2e/composer.spec.ts` — `submits consecutive entries with Enter and restores composer focus` | Yes | Yes | — |
| 15.3 | Escape dismisses suggestions without clearing input or moving focus. | `e2e/suggestions.spec.ts` — `dismisses suggestions without losing text and keeps accessibility state current` | Yes | Yes | — |
| 15.4 | The listbox, active descendant, option selection, pointer movement, and pointer leave expose current accessibility state. | Both new keyboard/accessibility `e2e/suggestions.spec.ts` scenarios above | Yes | Yes | — |
| 15.5 | Send controls have stable accessible names and suggestion actions show keyboard focus. | `e2e/suggestions.spec.ts` — `dismisses suggestions without losing text and keeps accessibility state current` | Yes | Yes | — |
| 15.6 | Desktop/mobile cover keyboard selection and AI bypass, pointer selection, dismissal, focus restoration, and stale responses. | The two new scenarios above; `reuses a stored suggestion on the selected day without an AI request`; `debounces a large history and ignores stale suggestion responses` | Yes | Yes | — |

## Issue 16 — Use shared date and meal inputs across editing and duplication

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 16.1 | Individual-entry editing and whole-meal duplication render the same shared Date and Meal inputs. | `frontend/src/app/components/ScheduleInputs.test.ts` — `exposes one controlled date-and-meal interface with the shared labels`; `e2e/shared-schedule-inputs.spec.ts` — `keeps Date and Meal behavior consistent across editing and duplication in every locale` | Yes | Yes | — |
| 16.2 | Labels, order, dimensions, options, disabled states, validation, and errors are consistent in both journeys. | `e2e/shared-schedule-inputs.spec.ts` — `keeps Date and Meal behavior consistent across editing and duplication in every locale`; `e2e/meal-duplication.spec.ts` — `rejects an invalid shared destination date and preserves the meal selection` | Yes | Yes | — |
| 16.3 | Shared inputs expose one typed value/change contract without mutation-specific save logic. | `frontend/src/app/components/ScheduleInputs.test.ts` — `exposes one controlled date-and-meal interface with the shared labels`; `lets a meal-only caller control a translated selection without clipping it` | Yes | Yes | — |
| 16.4 | Keyboard behavior, 44-pixel targets, focus treatment, and accessible labels are consistent on desktop and mobile. | `e2e/shared-schedule-inputs.spec.ts` — `keeps Date and Meal behavior consistent across editing and duplication in every locale`; both `e2e/ui-consistency.spec.ts` localized scenarios | Yes | Yes | — |
| 16.5 | Every supported locale contains translated dates, selected meals, and all meal options without clipping or document overflow. | `e2e/shared-schedule-inputs.spec.ts` — `keeps Date and Meal behavior consistent across editing and duplication in every locale` | Yes | Yes | — |
| 16.6 | Valid changes, invalid dates, locale rendering, entry moves, and whole-meal duplication are covered. | `e2e/ai-correction.spec.ts` — `moves the AI correction draft with explicit date and meal selectors`; `e2e/meal-duplication.spec.ts` — `chooses an explicit destination for a historical meal`; `rejects an invalid shared destination date and preserves the meal selection`; shared-locale scenario above | Yes | Yes | — |

## Issue 17 — Add an explicit composer meal target

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 17.1 | The composer visibly identifies its target meal before submission and uses the selected dashboard day. | `e2e/composer.spec.ts` — `uses the clock-derived meal target and selected dashboard day` | Yes | Yes | — |
| 17.2 | The shared meal control changes the target in one action while local time provides the zero-action default. | `e2e/composer.spec.ts` — `uses the clock-derived meal target and selected dashboard day`; `changes the composer meal target for AI and historical logging` | Yes | Yes | — |
| 17.3 | AI descriptions and historical suggestion reuse both save to the selected day and target meal. | `e2e/composer.spec.ts` — `changes the composer meal target for AI and historical logging` | Yes | Yes | — |
| 17.4 | Explicit meal intent returned by AI overrides the selected fallback target under the documented precedence rule. | `e2e/composer.spec.ts` — `lets explicit natural-language meal intent override the selected default` | Yes | Yes | — |
| 17.5 | Selecting a target introduces no confirmation or clarification step before logging. | `e2e/composer.spec.ts` — `changes the composer meal target for AI and historical logging`; `retains the selected meal target across consecutive submissions` | Yes | Yes | — |
| 17.6 | Default and changed meals, another selected day, historical AI bypass, explicit intent, and consecutive submissions have deterministic coverage. | All four Issue 17 `e2e/composer.spec.ts` scenarios above | Yes | Yes | — |

## Issue 18 — Edit and resubmit a failed description

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 18.1 | A failed submission exposes direct Retry and a clearly labeled edit action that restores exact text and focus. | `e2e/composer.spec.ts` — `preserves the exact failed submission and retries from the failed stage`; `edits and resubmits a failed description as a new parse attempt` | Yes | Yes | — |
| 18.2 | Editing preserves retained retry state until replacement submission or explicit cancellation. | `e2e/composer.spec.ts` — `edits and resubmits a failed description as a new parse attempt`; `cancels a failed-description edit without blocking unrelated submissions` | Yes | Yes | — |
| 18.3 | Save-stage Retry reuses recognized foods without another parse request. | `e2e/composer.spec.ts` — `preserves the exact failed submission and retries from the failed stage` | Yes | Yes | — |
| 18.4 | Edited text starts a new parse, supersedes the repaired failure, and does not duplicate status. | `e2e/composer.spec.ts` — `edits and resubmits a failed description as a new parse attempt` | Yes | Yes | — |
| 18.5 | Keyboard/touch/assistive interactions remain focused and do not block unrelated submissions. | Both new issue-18 `e2e/composer.spec.ts` scenarios above | Yes | Yes | — |
| 18.6 | Desktop/mobile cover parse/save retry, edit success, cancellation, exact text, focus, and reload persistence. | The existing retry scenario and both new issue-18 scenarios above | Yes | Yes | — |

## Issue 20 — Implement the approved adaptive desktop UI

The Issue 20 scenarios below exercise the implemented adaptive workspace. The
required responsive matrix is
390×844 compact mobile, 900×1024 tablet, 1280×720 desktop, and 1440×900 wide
desktop. Each scenario must run in the applicable deterministic desktop/mobile
projects against the running frontend, backend, and isolated PostgreSQL database,
without mocked application HTTP APIs in the browser.

Breakpoint proof additionally exercises the compact/desktop transition at
`767/768`. The resize journey must preserve route, selected date and meal,
draft, suggestions, pending/failure work, receipts, editor draft/selection,
History selection/scroll/duplication context, and Undo while asserting that the
resize-only window makes no day, history, parse, suggestion, or save request.

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 20.1 | Production layout, components, and responsive state follow the approved issue 19 architecture without introducing a second desktop-only implementation of core journeys. | `e2e/adaptive-workspace.spec.ts` — `preserves the logging session while crossing the compact and continuous-ledger workspace` crosses `767/768` in both browser projects, preserving the selected day, selected meal, draft, and sole semantic composer surface while asserting zero resize-caused application requests. | Yes | Yes | — |
| 20.2 | Desktop uses available width intentionally and keeps the nutrition summary useful while the composer is active. | `e2e/adaptive-workspace.spec.ts` — `renders one desktop header row with the visible composer and continuous ledger` verifies the compact kcal/protein/carbs/fat/fiber summary and date navigator occupy one contained physical row with no document overflow, the composer is already visible, all four ledger meals expose Add, and the compact sheet is absent. | Yes | Yes | — |
| 20.3 | Composer, suggestions, compact receipt summary, pending/failure feedback, meal rows, editor, date navigation, History, and whole-meal duplication remain coherent at every supported breakpoint. | `e2e/adaptive-workspace.spec.ts` — `keeps concurrent pending descriptions ordered and supports the newest group's snackbar Undo` verifies desktop submission order, in-place saved rows, the newest four-second acknowledgement, hover pause, and group-specific Undo; `lets History use the desktop workspace while the mobile shell stays compact` verifies History expands past the old compact-page limit on desktop while remaining contained by the mobile shell. Canonical coverage remains in `ai-correction.spec.ts`, `history.spec.ts`, `meal-duplication.spec.ts`, `suggestions.spec.ts`, and `date-navigation.spec.ts` in both projects. | Yes | Yes | — |
| 20.4 | Existing mobile journeys retain their established action counts, focus behavior, keyboard-safe layout, and touch targets unless an approved design explicitly improves them. | `e2e/adaptive-workspace.spec.ts` — `preserves the compact mobile composer sheet and meal presentation` verifies the desktop header is absent, the established Log food trigger opens the focused compact sheet, Escape closes it, and mobile meal presentation remains. It extends the existing canonical composer, suggestion, and shared-schedule journeys. | Yes | Yes | — |
| 20.5 | Loading, empty, success, failure, retry, Edit, Delete, Undo, and long localized content states have no clipping, overlap, or inaccessible off-screen controls. | `e2e/adaptive-workspace.spec.ts` — `keeps a failed description in its desktop ledger row with recovery actions`; concurrent pending/snackbar scenario above; `ai-correction.spec.ts` desktop inline-editor journeys; `composer.spec.ts` long-burst/retry journeys; and `date-navigation.spec.ts` — `fits localized dates in the one-row desktop journal header`. | Yes | Yes | — |
| 20.6 | The scenario inventory is updated and deterministic Playwright coverage exercises every affected journey at representative desktop and mobile sizes; the complete suite passes. | The six `e2e/adaptive-workspace.spec.ts` scenarios, the localized desktop-header scenario, and the canonical cross-journey specs run against the real frontend, backend, and isolated PostgreSQL stack. Completion evidence is recorded in issue 20 after the final frozen-tree run and artifact verification. | Yes | Yes | — |

## Issue 21 — Redesign dashboard date navigation

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 21.1 | Previous, selected date, and Next form one compact composed control with the selected date primary. | `e2e/date-navigation.spec.ts` — `navigates previous and next dates and labels the selected day`; `frontend/src/app/components/DateNavigator.test.ts` — `exposes a composed controlled previous, selected, and next-day interface` | Yes | Yes | — |
| 21.2 | Previous and Next retain at least 44 by 44 CSS-pixel targets without dominating the selected date. | Both `e2e/ui-consistency.spec.ts` localized scenarios; `frontend/src/app/components/DateNavigator.test.ts` — `exposes a composed controlled previous, selected, and next-day interface` | Yes | Yes | — |
| 21.3 | Today is exposed only off today, returns in one action, and its reserved slot prevents layout shift. | `e2e/date-navigation.spec.ts` — `keeps keyboard focus, announces one selected day, and returns to Today without shifting`; `returns directly to today from another date` | Yes | Yes | — |
| 21.4 | Activating the selected date opens the shared Date input for direct navigation. | `e2e/date-navigation.spec.ts` — `directly selects a date across a month and year boundary with destination labels`; `frontend/src/app/components/DateNavigator.test.ts` — `opens the shared date input from the selected date for direct navigation`; `keeps direct navigation open and reports an invalid cleared date` | Yes | Yes | — |
| 21.5 | Previous and Next names include destination dates, and one polite live region announces the selected day. | `e2e/date-navigation.spec.ts` — `directly selects a date across a month and year boundary with destination labels`; `keeps keyboard focus, announces one selected day, and returns to Today without shifting` | Yes | Yes | — |
| 21.6 | Long Russian, Polish, and Tatar dates remain contained at 320, 390, and 430 CSS pixels and fit the approved desktop layout without clipping or excessive empty space. | `e2e/date-navigation.spec.ts` — `contains long Russian Polish and Tatar dates at 320 390 and 430 pixels`; `fits localized dates in the one-row desktop journal header` verifies 768×900, 900×1024, 1280×720, and 1440×900 with nutrition before the right-aligned navigator, inline off-today action, one-row geometry, containment, and no duplicate summary. | Yes | Yes | — |
| 21.7 | Today, adjacent navigation, direct selection, month/year boundaries, locale widths, keyboard focus, announcements, and one-action return are deterministic on desktop and mobile. | All Issue 21 `e2e/date-navigation.spec.ts` scenarios above | Yes | Yes | — |

## Issue 22 — Slow the typewriter suggestion cadence

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 22.1 | Typing and deleting continue to rotate the localized food examples. | `frontend/src/app/hooks/useTypewriterPlaceholder.test.ts` — `types, holds, deletes, and rotates through the hardcoded suggestions`; `e2e/composer.spec.ts` — `rotates concise food examples without changing the input label` | Yes | Yes | — |
| 22.2 | A completed example stays visible for at least four seconds and a different example does not begin within seven seconds. | `frontend/src/app/hooks/useTypewriterPlaceholder.test.ts` — `keeps a completed suggestion fully visible for at least four seconds`; `does not start a different suggestion within seven seconds` | Yes | Yes | — |
| 22.3 | Cadence bounds use named timing constants and deterministic fake timers, not browser timing assertions. | The two cadence tests in `frontend/src/app/hooks/useTypewriterPlaceholder.test.ts` | Yes | Yes | — |
| 22.4 | User text wins immediately, and opening, closing, and submitting do not reveal stale characters. | `e2e/composer.spec.ts` — `keeps the label stable and the placeholder coherent with reduced motion` | Yes | Yes | — |
| 22.5 | Reduced motion renders one complete stable example while the accessible input label stays fixed. | `frontend/src/app/hooks/useTypewriterPlaceholder.test.ts` — `shows one complete suggestion without animation when motion is reduced`; `e2e/composer.spec.ts` — `keeps the label stable and the placeholder coherent with reduced motion` | Yes | Yes | — |
| 22.6 | Desktop and mobile cover the stable label and reduced-motion behavior. | `e2e/composer.spec.ts` — `keeps the label stable and the placeholder coherent with reduced motion` | Yes | Yes | — |

## Issue 23 — Merge historical suggestions by meal slug

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 23.1 | Suggestions sharing the same non-empty meal slug appear once. | `e2e/suggestions.spec.ts` — `merges shared-slug suggestions and keeps the highest-ranked representative`; `backend/src/routes/food-log.test.ts` — `keeps the highest-ranked configuration per non-empty slug while null slugs stay unique` | Yes | Yes | — |
| 23.2 | The first, highest-ranked exact configuration remains the representative in candidate order, preserving its stored values and usage metadata without aggregation. | `e2e/suggestions.spec.ts` — `merges shared-slug suggestions and keeps the highest-ranked representative`; `backend/src/routes/food-log.test.ts` — `keeps the highest-ranked configuration per non-empty slug while null slugs stay unique` | Yes | Yes | — |
| 23.3 | Null- and empty-slug candidates remain individually unique, and empty stored slugs are omitted from the response. | `e2e/suggestions.spec.ts` — `merges shared-slug suggestions and keeps the highest-ranked representative` covers distinct null-slug results; `backend/src/routes/food-log.test.ts` — `keeps the highest-ranked configuration per non-empty slug while null slugs stay unique`; `treats empty slugs as missing and keeps those suggestions individually unique` | Yes | Yes | — |
| 23.4 | Filtering is limited to the repository's requested ranked candidate set, with no backfill beyond `limit`, so merging may return fewer items. | `backend/src/routes/food-log.test.ts` — `filters only the requested ranked candidate set without backfilling after a slug merge` | Yes | Yes | — |
| 23.5 | Contracts and deterministic backend plus desktop/mobile browser coverage document and verify the rule, including Issue 23's supersession of Issue 06 only for shared non-empty slugs. | `contracts/food-log.ts` historical-suggestion contract documentation; all three Issue 23 `backend/src/routes/food-log.test.ts` scenarios above; `e2e/suggestions.spec.ts` — `merges shared-slug suggestions and keeps the highest-ranked representative`; Issue 06.2 inventory coverage above | Yes | Yes | — |

## Required state-shape coverage

The mapped specs collectively must include these cross-cutting states. A row may
be satisfied by a criterion scenario above rather than a separate test.

| State | Canonical scenario |
| --- | --- |
| Success and persisted reload | `logs every recognized food atomically and persists totals after reload` |
| Client validation | `keeps invalid structured edits with field-level feedback` |
| Empty | `opens a history day with itemized meals and totals` includes an empty-day arrangement |
| Loading | `shows parsing and saving rows in the target meal` |
| Retry | `preserves the exact failed submission and retries from the failed stage` |
| Recoverable backend failure | `rolls back the complete recognized group and offers retry` |
| Authorization | `cannot read, edit, delete, or restore another user's food entry` |
| Live provider smoke | `@live-ai parses and saves a real multi-food description` |
