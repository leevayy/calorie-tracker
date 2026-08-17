# 23 — Merge historical suggestions by meal slug

**What to build:** Filter the ranked candidates in `GET /api/v1/food-suggestions` so a canonical non-empty meal slug appears at most once. Foods without a slug remain individually unique.

**Blocked by:** None

**Priority:** P2

**Status:** ready-for-agent

**State:** closed

- [x] Suggestions sharing the same non-empty meal slug appear once.
- [x] The first, highest-ranked exact configuration is the representative, preserving candidate order and its stored values and usage metadata without aggregation.
- [x] Suggestions with a null or empty meal slug remain individually unique, and an empty stored slug is omitted from the response.
- [x] The route filters only the repository's requested ranked candidate set and does not backfill beyond `limit`, so a merge may return fewer than `limit` items.
- [x] Contracts and deterministic backend plus desktop/mobile browser coverage document and verify the behavior, including ticket 23's explicit supersession of ticket 06 only for shared non-empty slugs.

## Comments

- 2026-08-16: Chosen deterministic merge semantics: the repository remains responsible for exact-configuration grouping and relevance/frequency/recency ranking; the handler walks that at-most-`limit` candidate list in order and retains the first candidate for each populated slug. It does not sum usage counts or query beyond the requested candidate set. Ticket 06 still distinguishes configurations whose slugs differ or are absent.
- 2026-08-16: Implemented the ordered handler filter and omission of empty stored slugs. Red/green route coverage first exposed the duplicate same-slug row and the empty-slug response validation failure; test-control coverage likewise first rejected/persisted over an explicit null slug before the fixture seam was corrected.
- 2026-08-16: Final backend evidence: `npm --prefix backend test` passed 84/84 tests; the three directly affected files passed 31/31; `npm --prefix backend run check` and `git diff --check` passed. Contract documentation now records representative, aggregation, and limit behavior.
- 2026-08-16: Final deterministic browser evidence: the reconciled Issue 06/23 pair passed 4/4 in desktop Chromium and mobile WebKit against the real frontend, Fastify backend, and isolated PostgreSQL database. The Issue 23 scenario itself passed 2/2 and verifies the winning shared-slug configuration plus two genuinely null-slug suggestions; the companion scenario verifies different-slug configurations remain distinct. Four separate `video.webm` results were retained and `npm run e2e:verify-artifacts` passed. The full deterministic suite and live-AI checks were not run for this single-journey change; live AI is not involved in historical suggestion merging.
- 2026-08-16: The final consolidated matrix subsequently passed 152/152 with
  the Issue 06/23 scenarios green in both desktop Chromium and mobile WebKit,
  zero skipped/unexpected/flaky results, 152 separate videos, and clean
  standalone artifact verification. Live AI is not involved in this behavior.
