import { coercePreferredLanguage } from "./preferredLanguage";
import { parseIsoDateLocal } from "./date";

const NO_BREAK_SPACE = "\u00a0";

export function formatLocalizedNumber(
  value: number,
  language: string | undefined,
  options: Intl.NumberFormatOptions = {},
): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(coercePreferredLanguage(language), {
    maximumFractionDigits: 1,
    useGrouping: false,
    ...options,
  }).format(safeValue);
}

export function formatLocalizedGrams(value: number, language: string | undefined): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const parts = new Intl.NumberFormat(coercePreferredLanguage(language), {
    style: "unit",
    unit: "gram",
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).formatToParts(safeValue);

  return parts
    .map((part) =>
      part.type === "literal" && part.value.trim() === "" ? NO_BREAK_SPACE : part.value,
    )
    .join("");
}

export function formatLocalizedEnergy(
  value: number,
  language: string | undefined,
  localizedUnit: string,
): string {
  return `${formatLocalizedNumber(value, language)}${NO_BREAK_SPACE}${localizedUnit}`;
}

function uppercaseFirst(text: string, language: string): string {
  const [first, ...rest] = Array.from(text);
  return first ? first.toLocaleUpperCase(language) + rest.join("") : text;
}

/** Full standalone heading date; Russian month names intentionally remain lowercase. */
export function formatStandaloneCalendarDate(iso: string, language: string | undefined): string {
  const locale = coercePreferredLanguage(language);
  const formatted = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parseIsoDateLocal(iso));
  return uppercaseFirst(formatted, locale);
}

/** Sentence-safe date without a weekday, avoiding Russian grammatical-case collisions. */
export function formatInlineCalendarDate(iso: string, language: string | undefined): string {
  return new Intl.DateTimeFormat(coercePreferredLanguage(language), {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parseIsoDateLocal(iso));
}
