# 11 — Remove the legacy Android application

**What to build:** Remove the unsupported Android client and its device-local reference-food behavior so the web application is the only maintained product surface in this repository.

**Blocked by:** None — can start immediately.

**Priority:** P2

**Status:** ready-for-agent

**State:** closed

- [x] The legacy Android application and Android-only local nutrition behavior are removed from the maintained repository.
- [x] Project documentation, development instructions, and automation no longer imply that Android is supported.
- [x] Shared backend and web contracts retain only behavior used by the maintained product or another documented consumer.
- [x] The web application and backend build and test successfully after removal.

## Comments

- 2026-08-16: Removed the complete 54-file Android application, including its
  device-local Room reference-food database/search, Gradle wrapper, resources,
  and Android release workflow. Repository guidance now names only the web and
  backend as maintained surfaces. The obsolete path-based single-entry create
  endpoint, schema, frontend API/store, and documentation were also removed;
  the maintained web flow continues to use atomic `POST /entries/batch`, with a
  regression test proving the retired route is absent. Verification passed the
  backend TypeScript check, 11/11 E2E-tool tests, 79/79 backend tests, 118/118
  frontend tests, the frontend production build, reference scans, and
  `git diff --check`.
- 2026-08-16: Closed with the Android directory, workflow, source, resources, and
  Android-only contracts removed. Consolidated verification passed 84/84 backend
  tests, 118/118 frontend tests, the frontend production build, reference scans,
  and 152/152 deterministic Playwright checks (76 desktop and 76 mobile), with
  zero skipped, unexpected, or flaky results, 152 separate videos, clean artifact
  verification, and a clean diff check.
