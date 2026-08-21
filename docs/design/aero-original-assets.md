# Aero original UI artwork

All ornaments and icons in this catalog were drawn specifically for the calorie tracker. They
use project-authored SVG geometry, gradients, and filters; there are no third-party inputs or
proprietary platform assets.

## Direction and construction

- Visual direction: glossy gel plastic, aqua glass, chrome-white rims, leaves, bubbles, water,
  and small specular highlights.
- Creation date: 2026-08-21.
- Method: project-authored SVG sources; raster ornaments were rendered in local Chromium and
  encoded as lossless WebP with transparency.
- Prompts/references: no generative prompt or external visual reference was used. The project
  design interview supplied only the written eco-tech direction summarized above.
- Third-party inputs and licenses: none. All geometry, gradients, and filters were authored for
  this project, so there is no third-party attribution or license dependency.
- Text and trademarks: none.
- Density: raster dimensions support their intended placements at useful 1x or 2x density. The
  wide cloud strip may render near 1x on wide desktop surfaces; the smaller ornaments have 2x or
  greater headroom at their typical placements.
- Reproduction: editable ornament sources are retained in `frontend/public/aero/ui/sources/`.

## Manifest

The creation method and third-party-input record above apply to every row.

| Asset | Dimensions | Encoding / method | Bytes |
| --- | ---: | --- | ---: |
| `brand-orb.webp` | 256 x 256 | Lossless VP8L from project SVG | 22,818 |
| `cloud-strip.webp` | 1200 x 180 | Lossless VP8L from project SVG | 13,244 |
| `bubble-cluster.webp` | 360 x 360 | Lossless VP8L from project SVG | 61,154 |
| `leaf-sparkles.webp` | 400 x 320 | Lossless VP8L from project SVG | 25,574 |
| `water-ripples.webp` | 800 x 240 | Lossless VP8L from project SVG | 47,266 |
| `icons/nav-today.svg` | 48 x 48 view box | Project-authored SVG | 814 |
| `icons/nav-history.svg` | 48 x 48 view box | Project-authored SVG | 640 |
| `icons/nav-settings.svg` | 48 x 48 view box | Project-authored SVG | 720 |
| `icons/nav-account.svg` | 48 x 48 view box | Project-authored SVG | 858 |
| `icons/action-add.svg` | 48 x 48 view box | Project-authored SVG | 657 |
| `icons/action-send.svg` | 48 x 48 view box | Project-authored SVG | 547 |

The five raster outputs total 170,056 bytes; the six fixed-catalog icons total 4,236 bytes; and
the complete fixed UI catalog totals 174,292 bytes. The five editable SVG ornament sources are
an additional 4,249 bytes and are not runtime catalog entries. Navigation and action icons
retain visible labels and accessible names in application markup; the artwork is supplementary
and never the only semantic cue.
