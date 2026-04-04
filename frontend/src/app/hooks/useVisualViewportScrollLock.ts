import { type RefObject, useEffect } from "react";

const CSS_VISUAL_VIEWPORT_HEIGHT = "--visual-viewport-height";
const CSS_VISUAL_VIEWPORT_WIDTH = "--visual-viewport-width";
const PASSIVE: AddEventListenerOptions = { passive: true };

type SnapshottedStyleKey =
  | "position"
  | "top"
  | "left"
  | "right"
  | "width"
  | "height"
  | "touchAction"
  | "overflow"
  | "transform";

const SNAPSHOT_KEYS: SnapshottedStyleKey[] = [
  "position",
  "top",
  "left",
  "right",
  "width",
  "height",
  "touchAction",
  "overflow",
  "transform",
];

function snapshotStyles(
  element: HTMLElement,
): Partial<Record<SnapshottedStyleKey, string>> {
  const out: Partial<Record<SnapshottedStyleKey, string>> = {};
  for (const key of SNAPSHOT_KEYS) {
    out[key] = element.style[key];
  }
  return out;
}

function restoreStyles(
  element: HTMLElement,
  snap: Partial<Record<SnapshottedStyleKey, string>>,
) {
  for (const key of SNAPSHOT_KEYS) {
    element.style[key] = snap[key] ?? "";
  }
}

/**
 * Locks document scroll and keeps `document.documentElement`, `body`, and the given
 * overlay root aligned with `window.visualViewport`. Exposes pixel size on
 * `:root` as `--visual-viewport-height` and `--visual-viewport-width` for CSS
 * (e.g. keyboard-safe `calc()` on mobile, especially iOS Safari).
 */
export function useVisualViewportScrollLock(
  lockRootRef: RefObject<HTMLElement | null>,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const lockRoot = lockRootRef.current;

    if (!lockRoot) return;

    const rootDocument = lockRoot.ownerDocument;
    const htmlElement = rootDocument.documentElement;
    const bodyElement = rootDocument.body;
    const scrollingElement = rootDocument.scrollingElement ?? htmlElement;
    const elements = [htmlElement, bodyElement, lockRoot] as const;
    const savedStyles = elements.map((el) => snapshotStyles(el));

    const getScroll = () =>
      Math.max(scrollingElement.scrollTop, window.scrollY);
    const setScroll = (scroll: number) => {
      window.scrollTo(0, scroll);
      scrollingElement.scrollTo(0, scroll);
    };

    const initialScroll = getScroll();

    for (const element of elements) {
      element.style.position = "fixed";
      element.style.touchAction = "none";
      element.style.overflow = "clip";
      element.style.transform = "none";
    }
    lockRoot.style.isolation = "isolate";
    lockRoot.style.backfaceVisibility = "hidden";

    setScroll(0);

    const vv = window.visualViewport;

    const getViewportBox = () => {
      if (vv) {
        return {
          top: Math.max(0, Math.round(vv.offsetTop)),
          left: Math.max(0, Math.round(vv.offsetLeft)),
          width: Math.max(0, Math.round(vv.width)),
          height: Math.max(0, Math.round(vv.height)),
        };
      }
      return {
        top: 0,
        left: 0,
        width: Math.round(window.innerWidth),
        height: Math.round(window.innerHeight),
      };
    };

    const applyViewportBox = (box: ReturnType<typeof getViewportBox>) => {
      htmlElement.style.setProperty(
        CSS_VISUAL_VIEWPORT_HEIGHT,
        `${box.height}px`,
      );
      htmlElement.style.setProperty(
        CSS_VISUAL_VIEWPORT_WIDTH,
        `${box.width}px`,
      );
      for (const el of elements) {
        el.style.top = `${box.top}px`;
        el.style.left = `${box.left}px`;
        el.style.right = "auto";
        el.style.width = `${box.width}px`;
        el.style.height = `${box.height}px`;
      }
    };

    const syncViewport = () => {
      applyViewportBox(getViewportBox());
    };

    let syncRaf = 0;
    const scheduleSyncViewport = () => {
      if (syncRaf) return;
      syncRaf = requestAnimationFrame(() => {
        syncRaf = 0;
        syncViewport();
      });
    };

    let scrollLockRaf = 0;
    const preventWindowScroll = () => {
      if (scrollLockRaf) return;
      scrollLockRaf = requestAnimationFrame(() => {
        scrollLockRaf = 0;
        setScroll(0);
      });
    };

    syncViewport();

    const resizeTarget = vv ?? window;
    resizeTarget.addEventListener("resize", scheduleSyncViewport, PASSIVE);
    vv?.addEventListener("scroll", scheduleSyncViewport, PASSIVE);
    window.addEventListener("scroll", preventWindowScroll, PASSIVE);

    return () => {
      if (syncRaf) cancelAnimationFrame(syncRaf);
      if (scrollLockRaf) cancelAnimationFrame(scrollLockRaf);

      resizeTarget.removeEventListener("resize", scheduleSyncViewport, PASSIVE);
      vv?.removeEventListener("scroll", scheduleSyncViewport, PASSIVE);
      window.removeEventListener("scroll", preventWindowScroll, PASSIVE);

      elements.forEach((element, i) => {
        restoreStyles(element, savedStyles[i]!);
      });

      htmlElement.style.removeProperty(CSS_VISUAL_VIEWPORT_HEIGHT);
      htmlElement.style.removeProperty(CSS_VISUAL_VIEWPORT_WIDTH);
      lockRoot.style.removeProperty("isolation");
      lockRoot.style.removeProperty("backface-visibility");

      requestAnimationFrame(() => setScroll(initialScroll));
    };
  }, [lockRootRef, enabled]);
}
