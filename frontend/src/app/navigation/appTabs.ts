/** Single source for carousel order, URL segments, and nav chrome. Order: Settings → Home → History. */
export const APP_TAB_SEGMENTS = ["settings", "app", "history"] as const;
export type AppTabSegment = (typeof APP_TAB_SEGMENTS)[number];

export const APP_TAB_PATHS = ["/settings", "/app", "/history"] as const;
export type AppTabPath = (typeof APP_TAB_PATHS)[number];

export const DEFAULT_APP_TAB_SEGMENT: AppTabSegment = "app";

/** i18n keys for bottom nav `aria-label`; index aligns with `APP_TAB_SEGMENTS` / `ICONS` in `AppTabNav`. */
export const APP_TAB_NAV_TITLE_KEYS = ["settings.title", "main.title", "history.title"] as const;

export function isAppTabSegment(tab: string | undefined): tab is AppTabSegment {
  return tab !== undefined && (APP_TAB_SEGMENTS as readonly string[]).includes(tab);
}

export function pathToIndex(pathname: string): number {
  const i = APP_TAB_PATHS.indexOf(pathname as AppTabPath);
  return i >= 0 ? i : 1;
}

export function indexToPath(index: number): AppTabPath {
  const max = APP_TAB_PATHS.length - 1;
  return APP_TAB_PATHS[Math.min(Math.max(index, 0), max)];
}

export function pathToTitleKey(pathname: string): (typeof APP_TAB_NAV_TITLE_KEYS)[number] {
  return APP_TAB_NAV_TITLE_KEYS[pathToIndex(pathname)];
}
