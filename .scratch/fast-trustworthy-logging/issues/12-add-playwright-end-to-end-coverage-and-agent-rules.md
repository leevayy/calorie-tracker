# 12 — Add Playwright end-to-end coverage and agent testing rules

**What to build:** Add a Playwright system-test suite that exercises the maintained web application through a real browser against the real backend and test database. Cover the product's important user journeys with an isolated test user, and add repository agent rules that require future user-facing work to maintain this coverage.

**Blocked by:** 01 — Log all recognized foods atomically; 02 — Edit a saved food entry; 03 — Move or delete an entry with undo; 04 — Automatically save AI-recognized foods; 05 — Make the logging composer resilient and keyboard-fast; 06 — Suggest previously logged foods while typing; 07 — Navigate and log another day; 08 — Open and correct a day from history; 09 — Duplicate a previous meal; 10 — Retire the current coaching experience; 13 — Make AI correction the primary food-entry editor.

**Priority:** P0

**Status:** ready-for-agent

- [x] Playwright starts or connects to the production-shaped frontend and real backend, uses a dedicated test database, and drives supported desktop and mobile browser projects without mocking application HTTP APIs.
- [x] Test setup creates or resets an isolated test user through a documented seed/setup mechanism; tests do not depend on a developer's personal account, production data, test ordering, or leftovers from an earlier run.
- [x] A documented user-scenario inventory maps every maintained feature and the acceptance criteria from issues 01–10 and 13 to one or more Playwright tests, including authentication, profile/settings behavior that remains supported, logging, AI-first and structured fallback editing, coherent nutrition scaling, moving, deleting and undoing, automatic multi-food logging and rollback, consecutive and failed submissions, historical-food suggestions, date navigation, history corrections, meal duplication, totals, and authorization boundaries.
- [x] The core suite covers success, validation, empty, loading, retry, and recoverable failure states. Deterministic backend test controls may induce failures, but the browser still talks to the running backend and those controls are unavailable outside the test environment.
- [ ] At least one separately tagged live-AI smoke journey has been executed successfully against the configured real AI provider end to end. The deterministic regression suite does not become flaky or require paid external AI calls on every local run.
- [x] Assertions verify user-visible behavior and persisted results by reloading or revisiting the UI, rather than relying only on DOM state immediately after an action.
- [x] Commands exist for installing browsers, preparing the test environment, running the complete suite, running the live-AI smoke suite, and collecting traces, screenshots, videos, and backend logs on failure.
- [x] Secrets and test credentials come from ignored environment configuration; logs and artifacts demonstrably redact tokens and passwords and are excluded from source control where appropriate.
- [x] Repository AI/agent rules instruct agents that changes to user-visible behavior must add or update the corresponding scenario inventory and Playwright coverage, run the relevant end-to-end tests when the environment permits, and explicitly report any suite or live-AI checks that were not run.
- [x] CI runs the deterministic Playwright suite from a clean database and preserves useful failure artifacts; the live-AI smoke suite has an explicit opt-in or scheduled execution policy.
- [x] Setup and troubleshooting documentation is sufficient for a new contributor or coding agent to reproduce the full stack and test run locally.
- [x] The complete deterministic suite passes in every supported desktop and mobile project without skipped core journeys, retaining one video per test result.
- [x] Only the active tab and active dialog state are exposed to keyboard and assistive-technology users; pending and failure content is not duplicated between the underlying dashboard and the open composer.

## Comments

- 2026-08-15: Added the production-shaped runner, dedicated/resettable PostgreSQL
  controls, 55 mapped journeys across desktop Chromium and mobile WebKit, CI,
  documentation, agent rules, redacted artifact boundary, non-secret E2E session
  handles, and two opt-in live-provider smokes. The deterministic final run passed
  110/110 with 110 videos and no failure traces/screenshots. Live AI was not run
  locally because no provider key or folder id was configured; its fail-fast gate
  and test discovery were verified.
- 2026-08-16: Product review reran the expanded deterministic suite: desktop passed 58/58 and mobile passed 57/58. The mobile recovery scenario found duplicate failed-submission text in the underlying dashboard and open composer. Live AI remained unrun, and credential redaction in retained traces is not yet directly verified. Reopened the affected criteria.
- 2026-08-16: Hardened artifact cleanup against symlink ancestry, scanned file and
  ZIP-entry paths plus contents for configured and derived credentials, made
  interruption cleanup/verification once-only, and passed all 11 tooling tests.
  Browser assertions now prove that composer and editor modal backgrounds leave
  the accessibility tree while only one pending/failure copy remains exposed.
  The final deterministic run passed 150/150 with zero skips (75 desktop Chromium,
  75 mobile WebKit), exactly 150 unique video attachments/files, and both automatic
  and standalone artifact verification clean. Live AI remains unrun because the
  provider credentials and explicit paid-call enablement are not configured.
