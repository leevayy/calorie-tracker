# Playwright end-to-end testing

The Playwright suite drives the maintained web product through a real browser,
the running frontend, the real Fastify backend, and a dedicated PostgreSQL 16
database. Browser tests must not mock application HTTP APIs. Deterministic AI
responses and induced failures are permitted only through backend controls that
are enabled exclusively by `NODE_ENV=test` plus `E2E_TEST_MODE=1`.

The acceptance-criterion map and canonical planned test titles are in
[`playwright-scenarios.md`](playwright-scenarios.md).

## Projects and execution policy

`playwright.config.ts` runs tests serially with one worker and a fixed `en-US` /
UTC browser context. Every test records video. Failure screenshots and retained
failure traces are written with the HTML and JSON reports under the ignored
`artifacts/playwright/redacted/` boundary.

| Project | Browser shape | Included by default | Purpose |
| --- | --- | --- | --- |
| `desktop-chromium` | Desktop Chrome | Yes | Deterministic desktop regression |
| `mobile-webkit` | iPhone 13 / WebKit | Yes | Deterministic supported mobile regression |
| `live-ai-chromium` | Desktop Chrome | No | Paid/provider-backed `@live-ai` smoke only |

The live project exists only when `E2E_LIVE_AI=1`. Its tests must be named
`*.live.spec.ts` and include `@live-ai` in the title. Pull requests and ordinary
local runs never contact the external AI provider. CI runs live AI only on the
weekly schedule or when a maintainer opts in through `workflow_dispatch`.

## Prerequisites

- Node.js 24 and npm.
- PostgreSQL 16, locally or in Docker.
- Free ports for the backend and production-shaped frontend (the standard E2E
  base URL is `http://127.0.0.1:4173`).
- On Linux, permission to install Playwright's Chromium and WebKit system
  dependencies.

Create `.env.e2e` locally; it is ignored. Use only a dedicated disposable
database and synthetic credentials:

```dotenv
NODE_ENV=test
DATABASE_URL=postgresql://calorie_e2e:calorie_e2e_password@127.0.0.1:5432/calorie_tracker_e2e
JWT_SECRET=e2e-only-jwt-secret-at-least-16-characters
E2E_BASE_URL=http://127.0.0.1:4173
E2E_API_URL=http://127.0.0.1:3000
VITE_API_BASE_URL=http://127.0.0.1:3000
CORS_ALLOWED_ORIGINS=http://127.0.0.1:4173
E2E_TEST_MODE=1
E2E_CONTROL_SECRET=e2e-control-secret-at-least-16-characters
E2E_TEST_EMAIL=playwright@example.invalid
E2E_TEST_PASSWORD=playwright-local-only-password
E2E_ARTIFACT_DIR=artifacts/playwright/redacted
```

Never point `DATABASE_URL` at a development, shared, staging, or production
database: preparation resets the selected database. Never reuse a personal
account or production provider token.

## Reproducible commands

From the repository root:

```bash
npm ci
npm ci --prefix backend
npm ci --prefix frontend
npm run e2e:install
npm run e2e:prepare
npm run e2e:test
npm run e2e:verify-artifacts
```

The command responsibilities are:

- `e2e:install`: install the pinned Chromium and WebKit browsers.
- `e2e:prepare`: verify the database is E2E-only, migrate it, reset all mutable
  data, and seed the isolated user and deterministic backend controls.
- `e2e:verify-artifacts`: scan only the managed ignored artifact targets and
  fail unless every retained file can be verified as credential-free.
- `e2e:test`: build and start its own production-shaped frontend and backend on
  strict ports, reset stale reports/results (including old videos), then run
  both deterministic projects from a clean seed.
- `e2e:live`: run only `live-ai-chromium`; it must fail fast unless
  `E2E_LIVE_AI=1` and provider credentials are present.

For a focused deterministic run:

```bash
npm run e2e:test -- e2e/history.spec.ts --project=desktop-chromium
npm run e2e:test -- --grep "duplicates every food atomically" --project=mobile-webkit
```

Focused runs use the same managed full-stack lifecycle as the complete suite:
they prepare the disposable database, build and start both services, execute the
selected tests, and shut everything down.

For an explicitly authorized live smoke run:

```bash
E2E_LIVE_AI=1 npm run e2e:live
```

## Continuous integration

`.github/workflows/e2e.yml` provisions a new PostgreSQL 16 service for each job.
Pull requests and pushes to `main` prepare a clean seed, run desktop Chromium and
mobile WebKit serially. An always-run standalone verification step scans the
managed targets after the test process exits, including when setup, tests, or
cleanup fail abruptly. CI uploads those targets on ordinary test failures only
when verification succeeds; unverified artifacts are never uploaded. Artifacts
expire after seven days.

The live-AI job is absent from ordinary pushes and pull requests. It runs only
for the weekly schedule or a `workflow_dispatch` whose `live_ai` input is true,
and it fails before setup when the dedicated provider secrets are missing.

## Isolation and persisted assertions

- Preparation is idempotent and must run before a suite, not depend on test
  order, and never reuse leftovers from a previous run.
- Tests are serial so shared test controls and video ordering remain
  deterministic, but each test must arrange the state it relies on.
- Verify persistence by reloading or navigating away and back. Immediate DOM
  state alone is not proof that a mutation succeeded.
- Authorization scenarios use a second synthetic user and verify the protected
  entry remains unchanged through the UI or an ownership-scoped setup helper.
- Failure controls may be sent by setup helpers to the running backend. They
  must be rejected when either `NODE_ENV` is not `test` or `E2E_TEST_MODE` is
  not `1`.

## Artifact and secret policy

`artifacts/playwright/redacted/` is the only permitted report boundary.
`test-results/`, `html-report/`, `service-logs/`, and `results.json` are the only
managed reset, scan, and upload targets within it. `E2E_ARTIFACT_DIR` may select
that directory or one of its descendants, never a path outside it. Test code and
fixtures must ensure managed output is safe before CI upload:

- do not put passwords, bearer tokens, provider keys, full request headers,
  personal data, or database URLs in titles, logs, annotations, attachments, or
  snapshots;
- authenticate through setup/API state where possible so videos do not record a
  password being typed; when the authentication UI itself is under test, use
  only the documented disposable credentials;
- explicit test mode issues `e2e-public-session-v1` handles instead of JWTs;
  these handles are non-secret, work only in the disposable E2E runtime, and
  keep authenticated request traces free of credential-bearing tokens;
- attach sanitized summaries rather than raw backend requests or environment
  dumps;
- after every run, scan retained report paths and contents, service logs, videos,
  screenshots, and compressed trace entry paths and contents for the configured
  database URL, test email/password, control/JWT secrets, provider credentials,
  compact JWTs, bearer credentials, and serialized access/refresh tokens; any
  matching file is removed before upload and the run fails (the explicit
  `e2e-public-session-v1:` handles remain safe
  because they are non-secret and valid only in the disposable E2E runtime);
- quarantine unreadable archives, symlinks, and any other output that cannot be
  fully inspected; if scanning or quarantine fails, CI skips artifact upload;
- treat traces as sensitive even with synthetic accounts and keep CI retention
  short; and
- send or report each Playwright video as a separate file, named by project and
  test title. Do not merge multiple tests into a compilation.

## Troubleshooting

### A browser executable is missing

Run `npm run e2e:install`. On Linux, rerun the install command with the system
dependency option used by the repository script. Do not commit downloaded
browsers; their configured directories are ignored.

### WebKit works in CI but not locally

Confirm the Playwright browser version matches the root lockfile and install its
OS dependencies. Do not substitute a locally installed Safari build for the
`mobile-webkit` project.

### The page opens but API requests fail

Check that `E2E_BASE_URL` addresses the frontend, that its API base points to the
E2E backend, and that backend CORS allows that exact origin. Verify the backend
health endpoint before rerunning.

### Database preparation refuses to run

This is a safety check. Confirm the database name and user are explicitly E2E
scoped, then correct `.env.e2e`. Do not bypass the guard.

### Tests pass alone but fail as a suite

Run `npm run e2e:prepare` and rerun with one worker. Look for a test that relies
on order, leaves a failure control enabled, or fails to arrange its own data.

### A date assertion differs by one day

The browser context is UTC by default. Use explicit ISO calendar dates supplied
by the E2E clock/control instead of the workstation clock.

### No video was produced

Confirm the root config still has `video: "on"` and inspect the test's result
directory, including successful tests. Video must not be changed to
`retain-on-failure` because delivery requires every run.

### Live AI is skipped or refuses to start

Set `E2E_LIVE_AI=1`, select `live-ai-chromium`, and provide the dedicated CI/local
provider credentials. A deterministic run intentionally omits the live project.
Do not weaken the gate or add provider calls to deterministic specs.
