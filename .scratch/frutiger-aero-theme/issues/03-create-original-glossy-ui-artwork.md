# 03 — Create original glossy UI artwork

**What to build:** Create the fixed set of transparent ornaments and tactile
phone-era icons from `../spec.md`. Do not edit application code.

**Blocked by:** None

**Priority:** P1

**Status:** ready-for-agent

**State:** closed

- [x] Every ornament and icon in the fixed asset catalog exists at its exact path.
- [x] Artwork uses gel plastic, chrome rims, glass, bubbles, leaves, and tiny
      specular highlights to support the optimistic eco-tech direction.
- [x] Navigation and action icons remain recognizable without labels, while the
      application continues to provide visible and accessible labels.
- [x] Artwork is original and does not reproduce proprietary Windows, Apple,
      Nokia, Sony Ericsson, or other platform assets.
- [x] Raster assets have transparent backgrounds, useful 1x/2x density, and no
      baked-in text; SVGs are clean and appropriately optimized.
- [x] The manifest records creation method, prompts/references where applicable,
      dimensions, encoded size, and any third-party inputs or licenses.

## Exclusive ownership

- `frontend/public/aero/ui/**`
- `docs/design/aero-original-assets.md`

Do not edit application code, shared styles, stock scenes, or tests. If using AI
image generation, follow the repository environment's image-generation skill and
retain enough provenance to reproduce the result.

## Verification

- Inspect raster outputs at original resolution and against both light and dark
  backgrounds.
- Validate SVGs and report total and per-file sizes.

## Comments

- 2026-08-21: Created from the completed Frutiger Aero design-tree interview.
- 2026-08-21: Completed. Five transparent glossy ornaments and six original tactile SVG icons
  match the fixed catalog; alpha, dimensions, SVG validity, external-reference absence, light/dark
  compositing, provenance, and encoded sizes were verified.
