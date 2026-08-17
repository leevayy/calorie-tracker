import { useSyncExternalStore } from "react";

export const DESKTOP_LAYOUT_QUERY = "(min-width: 768px)";

function getDesktopSnapshot(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(DESKTOP_LAYOUT_QUERY).matches
    : false;
}

function subscribeToDesktopLayout(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }

  const query = window.matchMedia(DESKTOP_LAYOUT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Keeps responsive structure aligned with Tailwind's `md` breakpoint. */
export function useDesktopLayout(): boolean {
  return useSyncExternalStore(subscribeToDesktopLayout, getDesktopSnapshot, () => false);
}
