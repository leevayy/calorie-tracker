# Frutiger Aero optional appearance

## Goal

Add an optional Frutiger Aero appearance to every maintained web surface on
mobile and desktop. The design should feel like an optimistic landscape opened
through tactile mid-2000s phone and personal-appliance controls. Its emotional
target is freedom, healthy eco-optimism, and friendliness.

This is intentionally a strong treatment: approximately 7/10 Frutiger Aero
intensity, extensive photographic scenery and original ornament, glossy
skeuomorphism, deliberate visual clutter, and occasional low-density composition.

## Fixed product decisions

- Appearance and color mode are orthogonal. `standard` and `aero` appearances
  must each continue to support the existing light/dark behavior.
- Aero is optional and defaults off.
- The appearance preference is local to the browser. It does not add a backend
  profile field, API request, or database migration.
- Aero may change control presentation, gestures, transitions, disclosure, and
  navigation feedback. It must preserve routes, capabilities, data, recovery,
  and session state across the `767/768` responsive seam.
- Standard appearance remains visually and behaviorally unchanged.
- The visual world is a sunny open landscape with clean water, vivid grass,
  clouds, and a large horizon. Controls evoke original phone-era gel plastic,
  glass, chrome, LCDs, and appliance buttons without copying proprietary assets.
- Page scenery belongs to one continuous world: Today emphasizes grass and sky,
  History emphasizes reflective water, Settings resembles a translucent control
  pavilion, and Auth is the welcoming establishing scene.
- Stock photography may be used extensively. Every asset must have verified
  permission for use and modification, be vendored rather than hotlinked, and
  have provenance recorded even when attribution is optional.
- Functional labels remain direct. A small amount of localized atmospheric copy
  is allowed in headers and empty states.
- Sound is out of scope for the first version.

## Shared implementation contract

- Appearance type: `"standard" | "aero"`.
- Browser storage key: `appearance`.
- Missing or invalid stored values resolve to `standard`.
- The root element exposes `data-appearance="standard"` or
  `data-appearance="aero"` before first paint to avoid a visual flash.
- Existing `.dark` behavior and its storage contract remain intact.
- Aero selectors use `:root[data-appearance="aero"]` and
  `:root.dark[data-appearance="aero"]`.
- Each surface owns a separate stylesheet under `frontend/src/styles/aero/` and
  imports it from a file in that surface's ownership. Parallel agents must not
  edit the central stylesheet to register another task's file.
- Page agents may reference the fixed asset names below before the corresponding
  asset branch is integrated. Missing assets in an isolated branch are not a
  reason to change the catalog.
- Page agents should prefer CSS-driven appearance changes. Any theme-specific
  interaction logic must use the shared appearance state and must not create a
  second business-behavior model.

## Fixed asset catalog

Photographic scenes:

- `/aero/scenes/auth-{day|night}-{mobile|desktop}.webp`
- `/aero/scenes/today-{day|night}-{mobile|desktop}.webp`
- `/aero/scenes/history-{day|night}-{mobile|desktop}.webp`
- `/aero/scenes/settings-{day|night}-{mobile|desktop}.webp`

Original UI artwork:

- `/aero/ui/brand-orb.webp`
- `/aero/ui/cloud-strip.webp`
- `/aero/ui/bubble-cluster.webp`
- `/aero/ui/leaf-sparkles.webp`
- `/aero/ui/water-ripples.webp`
- `/aero/ui/icons/nav-today.svg`
- `/aero/ui/icons/nav-history.svg`
- `/aero/ui/icons/nav-settings.svg`
- `/aero/ui/icons/nav-account.svg`
- `/aero/ui/icons/action-add.svg`
- `/aero/ui/icons/action-send.svg`

## Accessibility boundary

Period-authentic excess is permitted where it improves atmosphere: ornamental
labels may be small, secondary decoration may be low contrast, controls may be
extremely shiny, and screens may contain deliberate skeuomorphic clutter.

The following remain non-negotiable:

- keyboard access and logical focus order;
- visible focus on interactive controls;
- stable accessible names and semantic state;
- focus containment and background exclusion for modal interfaces;
- readable essential food, nutrition, form, error, and destructive-action text;
- at least 44 by 44 CSS-pixel primary touch targets;
- reduced-motion behavior;
- mobile safe areas and keyboard-visible composition;
- no inaccessible off-screen controls or document overflow; and
- containment of all supported locales.

## Responsive and performance contract

- Maintain the existing structural breakpoint at `768px`.
- Cover 390x844 mobile, 900x1024 tablet, 1280x720 desktop, and 1440x900 wide
  desktop, plus the explicit `767/768` transition.
- Check long localized content at 320, 390, and 430 CSS pixels.
- Initial Aero route transfer should remain near 2 MB compressed. Page-specific
  scenes are lazy-loaded, and imagery has gradient/color fallbacks.
- Suggested maximums are approximately 350 KB per mobile scene and 650 KB per
  desktop scene after encoding.
- Decorative layers must not intercept carousel gestures, clicks, focus,
  drawers, dialogs, or scrolling.

## Parallel execution

Issues 01 through 08 are deliberately unblocked and have exclusive file
ownership. They can run simultaneously in separate branches/worktrees using this
spec as their only shared contract. They must not coordinate by editing another
issue's files.

Issue 09 is the sole convergence task. It merges the parallel work, resolves
integration problems, runs full verification, and records honest desktop,
mobile, and live-AI evidence.

