import { PreferredLanguageSchema, type PreferredLanguage } from "@contracts/common";

export const DEFAULT_PREFERRED_LANGUAGE: PreferredLanguage = "en";
export const PREFERRED_LANGUAGE_STORAGE_KEY = "calorie-tracker-language";

/** Accept app codes as well as browser-style tags such as `ru-RU`. */
export function preferredLanguageFromCode(code: string | undefined | null): PreferredLanguage | null {
  const baseCode = code?.trim().toLocaleLowerCase().split(/[-_]/, 1)[0];
  const parsed = PreferredLanguageSchema.safeParse(baseCode);
  return parsed.success ? parsed.data : null;
}

export function coercePreferredLanguage(code: string | undefined): PreferredLanguage {
  return preferredLanguageFromCode(code) ?? DEFAULT_PREFERRED_LANGUAGE;
}

export function loadPersistedPreferredLanguage(): PreferredLanguage | null {
  if (typeof window === "undefined") return null;
  try {
    return preferredLanguageFromCode(window.localStorage.getItem(PREFERRED_LANGUAGE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function persistPreferredLanguage(code: string): void {
  if (typeof window === "undefined") return;
  const language = preferredLanguageFromCode(code);
  if (!language) return;
  try {
    window.localStorage.setItem(PREFERRED_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage can be unavailable in private or locked-down browser contexts.
  }
}

export function browserPreferredLanguage(): PreferredLanguage | null {
  if (typeof navigator === "undefined") return null;
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const language = preferredLanguageFromCode(candidate);
    if (language) return language;
  }
  return null;
}

/** Last explicit choice wins; browser language is only the first-visit default. */
export function initialPreferredLanguage(): PreferredLanguage {
  return (
    loadPersistedPreferredLanguage() ??
    browserPreferredLanguage() ??
    DEFAULT_PREFERRED_LANGUAGE
  );
}

export const PREFERRED_LANGUAGE_OPTIONS: { value: PreferredLanguage; labelKey: string }[] = [
  { value: "en", labelKey: "languages.en" },
  { value: "ru", labelKey: "languages.ru" },
  { value: "pl", labelKey: "languages.pl" },
  { value: "tt", labelKey: "languages.tt" },
  { value: "kk", labelKey: "languages.kk" },
];
