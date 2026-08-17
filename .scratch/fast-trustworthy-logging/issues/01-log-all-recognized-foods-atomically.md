# 01 — Log all recognized foods atomically

**What to build:** Let the user save every food produced by one AI parse with a single action. The group must be persisted as one operation so a failure cannot leave only part of the recognized meal in the log.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

**State:** closed

- [x] A successful parse containing one or several foods presents one action that logs the complete recognized group to the selected meal and day.
- [x] All entries from the group are created together and the daily totals update once the operation succeeds.
- [x] If any entry cannot be created, none of the group remains in the log and the recognized foods remain available for retry.
- [x] Automated tests cover successful multi-food creation and rollback on failure.

## Comments

- 2026-08-15: Implemented with a cross-day/meal batch contract and explicit database transaction. Frontend and backend tests cover complete-group success plus retry-safe rollback.
- 2026-08-16: Closed after the atomic batch success and rollback coverage passed within the consolidated validation: backend 84/84, frontend 118/118, and deterministic Playwright 152/152 (76 desktop Chromium and 76 mobile WebKit), with zero skips, unexpected results, or flaky results, 152 separate videos, and clean artifact verification.
