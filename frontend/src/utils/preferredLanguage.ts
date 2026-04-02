import { PreferredLanguageSchema, type PreferredLanguage } from "@contracts/common";

export function coercePreferredLanguage(code: string | undefined): PreferredLanguage {
  const parsed = PreferredLanguageSchema.safeParse(code);
  return parsed.success ? parsed.data : "en";
}

export const PREFERRED_LANGUAGE_OPTIONS: { value: PreferredLanguage; labelKey: string }[] = [
  { value: "en", labelKey: "languages.en" },
  { value: "ru", labelKey: "languages.ru" },
  { value: "pl", labelKey: "languages.pl" },
  { value: "tt", labelKey: "languages.tt" },
];
