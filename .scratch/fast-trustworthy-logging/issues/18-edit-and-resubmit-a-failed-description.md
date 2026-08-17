# 18 — Edit and resubmit a failed food description

**What to build:** Preserve the existing one-action Retry for transient failures while also letting the user repair a malformed or mistyped failed description without typing it again from scratch.

**Blocked by:** 05 — Make the logging composer resilient and keyboard-fast.

**Priority:** P1

**Status:** ready-for-agent

**State:** closed

- [x] A failed submission offers both direct Retry and a clearly labeled action that restores its exact text to the focused composer for editing.
- [x] Editing a failed description does not mutate or discard its retained retry state until the replacement is submitted or explicitly cancelled.
- [x] Retrying a save-stage failure reuses the recognized foods without another AI parse request.
- [x] Submitting edited text creates a new parse attempt with the edited text and removes or supersedes the repaired failure without duplicating active status messages.
- [x] The interaction remains usable with keyboard, touch, and assistive technology and does not block consecutive unrelated submissions.
- [x] Deterministic desktop/mobile tests cover parse retry, save retry, edit-and-resubmit success, cancellation, focus, exact text preservation, and persistence after reload.

## Comments

- 2026-08-16: Added exact-text Edit description/Cancel edit alongside stage-aware Retry, retained save-stage foods, superseding edited parses, focused keyboard flow, and schema-validated user-scoped session persistence. The storage and interaction coverage is green in the 112/112 frontend suite; parse/save retry, edit success, cancellation, focus, unrelated submission, and reload scenarios passed in the 14/14 desktop composer run and are registered for mobile in the running complete matrix.
- 2026-08-16: Closed with consolidated verification: backend 84/84,
  frontend 118/118, production build and backend check green, and deterministic
  Playwright 152/152 (76 desktop + 76 mobile) with zero skipped, unexpected, or
  flaky results, 152 separate videos, and clean artifact verification.
