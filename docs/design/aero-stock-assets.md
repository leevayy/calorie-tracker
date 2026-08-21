# Aero scenery asset provenance

The Aero scenery is original generated artwork rather than third-party stock. This avoids
hotlinks and attribution dependencies while keeping every surface in one continuous world.

## Rights and provenance

- Creator: OpenAI image generation, directed in this repository on 2026-08-21.
- Generation/acquisition date: 2026-08-21. A separate retrieval date does not apply because
  the work was generated for this project rather than downloaded from a third-party library.
- Third-party inputs: none. The night source was derived only from the generated day source.
- Source URL: not applicable; the generated masters are retained in the originating Codex task.
- Usage basis: as between the customer/user and OpenAI, output ownership is assigned to the
  customer/user to the extent permitted by law under section 4.1 of the
  [OpenAI Services Agreement](https://openai.com/policies/services-agreement/) for business and
  developer services and the Content ownership provision of the
  [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/) for individual services. The
  originating account determines which terms apply. Both pages and their applicability language
  were re-verified on 2026-08-21; the Services Agreement was updated December 1, 2025 and became
  effective January 1, 2026, and the Europe Terms of Use were updated January 16, 2026. Both also
  note that output may not be unique and that the customer/user must evaluate it for the use case.
- Modifications: page-specific crops, Lanczos resizing, metadata-free WebP encoding, and a
  lighting-only day-to-night transformation.
- Review: no people, trademarks, text, dieting/medical imagery, or third-party assets are present.
- Master retention: the generated masters are attached to the originating Codex task, not
  vendored in this repository. The prompts below and the final crops are the repository-local
  reproducibility record.

## Generation prompts

Day master:

> Create an original, extremely wide continuous optimistic landscape that can be cropped into
> four connected page scenes: a welcoming grassy garden, a broad sunny meadow, a reflective
> clean-blue lake, and a light glass pavilion among greenery. Use a large open horizon, vivid
> healthy grass, clean water, cotton clouds, rounded green hills, and gentle early-2000s eco-tech
> advertising idealism. Keep low-detail space for translucent UI. No people, text, logos,
> trademarks, medical imagery, or branded architecture.

Night master edit:

> Transform the exact day landscape into a serene clear night version. Preserve the geometry,
> horizon, hills, lake, grass, trees, pavilion, crop zones, and absence of people and text. Change
> only the sky, illumination, reflections, and atmosphere: cobalt-to-indigo moonlight, subtle
> stars, cyan water reflections, and a gentle warm pavilion glow.

## Output manifest

The provenance, rights basis, acquisition date, and modification history above apply to every
row. Desktop outputs are 1440 x 900. Mobile outputs are 780 x 1688, composed for a 390 x 844 CSS
viewport at 2x density.

| Asset | Dimensions | Bytes |
| --- | ---: | ---: |
| `auth-day-desktop.webp` | 1440 x 900 | 201,322 |
| `auth-day-mobile.webp` | 780 x 1688 | 148,992 |
| `auth-night-desktop.webp` | 1440 x 900 | 151,880 |
| `auth-night-mobile.webp` | 780 x 1688 | 114,546 |
| `today-day-desktop.webp` | 1440 x 900 | 186,410 |
| `today-day-mobile.webp` | 780 x 1688 | 85,666 |
| `today-night-desktop.webp` | 1440 x 900 | 140,398 |
| `today-night-mobile.webp` | 780 x 1688 | 74,068 |
| `history-day-desktop.webp` | 1440 x 900 | 173,054 |
| `history-day-mobile.webp` | 780 x 1688 | 75,820 |
| `history-night-desktop.webp` | 1440 x 900 | 128,232 |
| `history-night-mobile.webp` | 780 x 1688 | 57,552 |
| `settings-day-desktop.webp` | 1440 x 900 | 178,910 |
| `settings-day-mobile.webp` | 780 x 1688 | 104,114 |
| `settings-night-desktop.webp` | 1440 x 900 | 128,378 |
| `settings-night-mobile.webp` | 780 x 1688 | 77,586 |

All files are vendored under `frontend/public/aero/scenes/`. The full catalog is 2,026,928 bytes
on disk; a route selects one scene variant rather than transferring the entire catalog.
