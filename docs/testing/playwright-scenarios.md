# Playwright user-scenario inventory

This is the canonical browser-coverage map for the maintained web application.
Each acceptance criterion from local issues 01–10 and 13 has its own row. Test
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
| Authentication lifecycle | `e2e/auth.spec.ts` — `signs up, signs in, persists the session, and signs out` | Yes | Yes | — |
| Authentication validation | `e2e/auth.spec.ts` — `shows validation and rejects invalid credentials without losing input` | Yes | Yes | — |
| Supported profile/settings | `e2e/settings.spec.ts` — `updates supported profile fields and language after reload` | Yes | Yes | — |
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
| 02.2 | Common fields are easy to reach and detailed nutrients remain editable without overwhelming the initial view. | `e2e/ai-correction.spec.ts` — `switches to Edit fields and exposes detailed nutrients without losing the draft` | Yes | Yes | — |
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
| 05.1 | Enter submits and leaves the composer ready for another entry. | `e2e/composer.spec.ts` — `submits consecutive entries with Enter and restores composer focus` | Yes | Yes | — |
| 05.2 | A pending row appears in the target meal during parse/save. | `e2e/composer.spec.ts` — `shows parsing and saving rows in the target meal` | Yes | Yes | — |
| 05.3 | Parse/save failure preserves exact text and offers direct retry. | `e2e/composer.spec.ts` — `preserves the exact failed submission and retries from the failed stage` | Yes | Yes | — |
| 05.4 | Explicit portion/calorie/nutrient values override inference. | `e2e/composer.spec.ts` — `honors explicit portion and nutrition values over inference` derives the submitted literals over deliberately conflicting deterministic inference | Yes | Yes | — |
| 05.5 | Consecutive submission, recovery, and focus behavior are covered. | `e2e/composer.spec.ts` — `submits consecutive entries with Enter and restores composer focus`; `preserves the exact failed submission and retries from the failed stage` | Yes | Yes | — |

## Issue 06 — Suggest previously logged foods

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 06.1 | Typing shows historical matches with name, portion, calories, and usage context. | `e2e/suggestions.spec.ts` — `suggests historical foods with nutrition and usage context` | Yes | Yes | — |
| 06.2 | Same-name foods with materially different configurations remain distinct. | `e2e/suggestions.spec.ts` — `keeps same-name historical configurations distinct` | Yes | Yes | — |
| 06.3 | Ranking reflects relevance, frequency, and recency. | `e2e/suggestions.spec.ts` — `ranks historical suggestions by relevance frequency and recency` | Yes | Yes | — |
| 06.4 | Selecting a result logs stored values to selected meal/day without AI. | `e2e/suggestions.spec.ts` — `reuses a stored suggestion on the selected day without an AI request` | Yes | Yes | — |
| 06.5 | Search stays responsive as history grows and matching/ranking are covered. | `e2e/suggestions.spec.ts` — `debounces a large history and ignores stale suggestion responses` forces the older response to arrive after the newer response through a one-shot backend delay | Yes | Yes | — |

## Issue 07 — Navigate and log another day

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 07.1 | Dashboard labels the selected date and provides previous/next navigation. | `e2e/date-navigation.spec.ts` — `navigates previous and next dates and labels the selected day` | Yes | Yes | — |
| 07.2 | Selected-day meals/totals load without losing navigation context. | `e2e/date-navigation.spec.ts` — `keeps the selected day and its totals while navigating` | Yes | Yes | — |
| 07.3 | AI submissions and historical suggestions save only to the selected day. | `e2e/date-navigation.spec.ts` — `logs AI and historical suggestions into the selected day only`; `e2e/live-ai.live.spec.ts` — `@live-ai parses and saves a real multi-food description` | Yes | Yes | Yes |
| 07.4 | A direct return-to-today action is available off today. | `e2e/date-navigation.spec.ts` — `returns directly to today from another date` | Yes | Yes | — |
| 07.5 | Date-boundary tests prove submissions never leak to another day. | `e2e/date-navigation.spec.ts` — `does not leak submissions across calendar-day boundaries` | Yes | Yes | — |

## Issue 08 — Open and correct a history day

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 08.1 | Selecting a history day opens itemized meals and totals for that date. | `e2e/history.spec.ts` — `opens a history day with itemized meals and totals` | Yes | Yes | — |
| 08.2 | History detail supports edit, move, delete, and Undo. | `e2e/history.spec.ts` — `edits moves deletes and undoes from history detail` | Yes | Yes | — |
| 08.3 | Corrections update the detail and aggregate history immediately. | `e2e/history.spec.ts` — `reconciles history detail and aggregate after a correction` | Yes | Yes | — |
| 08.4 | Returning to history preserves the previous history context. | `e2e/history.spec.ts` — `returns to the same history scroll context` | Yes | Yes | — |
| 08.5 | Opening and aggregate correction are covered. | `e2e/history.spec.ts` — `opens a history day with itemized meals and totals`; `reconciles history detail and aggregate after a correction` | Yes | Yes | — |

## Issue 09 — Duplicate a previous meal

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 09.1 | Historical meal detail has a duplicate action with explicit destination day/meal. | `e2e/meal-duplication.spec.ts` — `chooses an explicit destination for a historical meal` | Yes | Yes | — |
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

## Issue 13 — AI correction is the primary entry editor

| AC | Acceptance criterion | Planned spec and exact test title | D | M | L |
| --- | --- | --- | :---: | :---: | :---: |
| 13.1 | Tapping a saved food opens AI correction by default with a visible instruction input. | `e2e/ai-correction.spec.ts` — `opens AI correction by default for a saved entry`; `e2e/live-ai.live.spec.ts` — `@live-ai proposes and saves a correction from stored entry context` | Yes | Yes | Yes |
| 13.2 | The correction request uses the stored entry as structured context. | `e2e/ai-correction.spec.ts` — `uses the stored structured entry as correction context`; `e2e/live-ai.live.spec.ts` — `@live-ai proposes and saves a correction from stored entry context` | Yes | Yes | Yes |
| 13.3 | Schema-validated AI output becomes a complete inspectable draft before persistence. | `e2e/ai-correction.spec.ts` — `validates a complete AI draft before Save persists it`; `e2e/live-ai.live.spec.ts` — `@live-ai proposes and saves a correction from stored entry context` | Yes | Yes | Yes |
| 13.4 | Proportional instructions scale calories and all nutrients exactly; portion changes only when implied. | `e2e/ai-correction.spec.ts` — `scales calories and every nutrient exactly for a proportional instruction` | Yes | Yes | — |
| 13.5 | Application code performs deterministic arithmetic after operation identification. | `e2e/ai-correction.spec.ts` — `scales calories and every nutrient exactly for a proportional instruction` | Yes | Yes | — |
| 13.6 | Date and meal remain explicit selectors in AI mode. | `e2e/ai-correction.spec.ts` — `moves the AI correction draft with explicit date and meal selectors` | Yes | Yes | — |
| 13.7 | A secondary Edit fields control opens the complete structured fallback. | `e2e/ai-correction.spec.ts` — `switches to Edit fields and exposes detailed nutrients without losing the draft` | Yes | Yes | — |
| 13.8 | AI and structured modes share one draft without discarding changes. | `e2e/ai-correction.spec.ts` — `shares one correction draft while switching AI and structured modes` | Yes | Yes | — |
| 13.9 | Invalid/ambiguous/failed AI leaves persistence unchanged, preserves instruction, and offers fallback. | `e2e/ai-correction.spec.ts` — `preserves the instruction and persisted entry after a failed AI correction` | Yes | Yes | — |
| 13.10 | Either mode updates row, source/destination totals, and history exactly once through owned update. | `e2e/ai-correction.spec.ts` — `saves either correction mode exactly once and reconciles every aggregate`; `e2e/authorization.spec.ts` — `cannot read, edit, delete, or restore another user's food entry` | Yes | Yes | — |
| 13.11 | Default state, scaling, selectors, switching, recovery, persistence, aggregates, and authorization are automated. | All `e2e/ai-correction.spec.ts` scenarios above; `e2e/authorization.spec.ts` ownership scenario; live correction smoke | Yes | Yes | Yes |

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
