## Maintained product

The maintained product surfaces in this repository are the web frontend and backend. There is no maintained native mobile application.

## Agent skills

### Issue tracker

Issues and specs are tracked as local Markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the canonical labels `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain-doc layout. See `docs/agents/domain.md`.

## Playwright system tests

User-visible web behavior is covered by the real-browser Playwright suite. See
`docs/testing/playwright.md` for commands and `docs/testing/playwright-scenarios.md`
for the acceptance-criterion map.

For every change to user-visible web behavior, agents must:

- add or update the corresponding row in the scenario inventory;
- add or update deterministic Playwright coverage in `e2e/` for every supported
  desktop/mobile journey affected by the change;
- use the running frontend, backend, and isolated test database without mocking
  application HTTP APIs in the browser;
- run the relevant Playwright spec when the E2E environment is available, and run
  the complete deterministic suite when the change spans multiple journeys;
- explicitly report which deterministic desktop, mobile, and live-AI checks were
  run and which were not run; never imply an unrun check passed;
- keep `@live-ai` tests in `*.live.spec.ts`; deterministic tests must use only
  test-environment backend controls and must not make paid external AI calls; and
- keep credentials, bearer tokens, and personal data out of test titles, logs,
  attachments, screenshots, traces, videos, and committed files. Artifacts belong
  only under the ignored redacted artifact directory configured by Playwright.

Every Playwright test records video. Preserve one video per test result when
reporting or delivering a run; do not combine multiple test videos into one file.
