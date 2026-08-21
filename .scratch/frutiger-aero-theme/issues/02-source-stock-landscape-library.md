# 02 — Source the stock landscape library

**What to build:** Source, crop, encode, and document the photographic landscape
layer in the fixed catalog from `../spec.md`. Do not edit application code.

**Blocked by:** None

**Priority:** P1

**Status:** ready-for-agent

**State:** closed

- [x] Day and night mobile/desktop scene files exist for Auth, Today, History,
      and Settings using the exact fixed filenames.
- [x] The scenes form one optimistic world of open horizons, clean water, vivid
      grass, clouds, sunlight or moonlight, and personal freedom.
- [x] Crops are composed intentionally for 390x844 and 1440x900 rather than
      relying on accidental `background-size: cover` results.
- [x] Images avoid trademarks, baked-in text, medical/dieting clichés, and visual
      detail that makes translucent controls unreadable.
- [x] Every source has verified rights for web-product use and modification; no
      asset relies only on a search result's “free” label.
- [x] Every asset is vendored, optimized, stripped of unnecessary metadata, and
      near the size guidance in `../spec.md`.
- [x] The manifest records source URL, creator, license, retrieval date,
      modifications, output dimensions, and encoded size.

## Exclusive ownership

- `frontend/public/aero/scenes/**`
- `docs/design/aero-stock-assets.md`

Do not edit application code, shared styles, original UI artwork, or tests.

## Verification

- Inspect every output at original resolution and at its target viewport crop.
- Verify the manifest against the downloaded sources' current license pages.
- Report total and per-file encoded sizes.

## Comments

- 2026-08-21: Stock imagery is unrestricted in artistic quantity, but all legal
  reuse and modification terms still apply.
- 2026-08-21: Completed with original generated scenery instead of third-party stock, preserving
  the fixed catalog while removing hotlink/attribution risk. All 16 crops, provenance, dimensions,
  metadata, WebP decode, size limits, and target-aspect visual checks passed.
