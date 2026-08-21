import { coercePreferredLanguage } from "./preferredLanguage";
import { parseIsoDateLocal } from "./date";

const NO_BREAK_SPACE = "\u00a0";

const MANUAL_CALENDAR_NAMES = {
  tt: {
    months: [
      "гыйнвар",
      "февраль",
      "март",
      "апрель",
      "май",
      "июнь",
      "июль",
      "август",
      "сентябрь",
      "октябрь",
      "ноябрь",
      "декабрь",
    ],
    weekdays: [
      "якшәмбе",
      "дүшәмбе",
      "сишәмбе",
      "чәршәмбе",
      "пәнҗешәмбе",
      "җомга",
      "шимбә",
    ],
  },
  kk: {
    months: [
      "қаңтар",
      "ақпан",
      "наурыз",
      "сәуір",
      "мамыр",
      "маусым",
      "шілде",
      "тамыз",
      "қыркүйек",
      "қазан",
      "қараша",
      "желтоқсан",
    ],
    weekdays: [
      "жексенбі",
      "дүйсенбі",
      "сейсенбі",
      "сәрсенбі",
      "бейсенбі",
      "жұма",
      "сенбі",
    ],
  },
} as const;

function formatManualCalendarDate(
  iso: string,
  locale: "tt" | "kk",
  includeWeekday: boolean,
): string {
  const date = parseIsoDateLocal(iso);
  const names = MANUAL_CALENDAR_NAMES[locale];
  const day = date.getDate();
  const month = names.months[date.getMonth()];
  const year = date.getFullYear();
  const weekday = names.weekdays[date.getDay()];

  if (locale === "tt") {
    return `${day} ${month}, ${year} ел${includeWeekday ? `, ${weekday}` : ""}`;
  }
  return `${year} жылғы ${day} ${month}${includeWeekday ? `, ${weekday}` : ""}`;
}

export function formatLocalizedNumber(
  value: number,
  language: string | undefined,
  options: Intl.NumberFormatOptions = {},
): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(coercePreferredLanguage(language), {
    useGrouping: false,
    ...options,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeValue);
}

export function formatLocalizedGrams(value: number, language: string | undefined): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const parts = new Intl.NumberFormat(coercePreferredLanguage(language), {
    style: "unit",
    unit: "gram",
    unitDisplay: "short",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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
  if (locale === "tt" || locale === "kk") {
    return formatManualCalendarDate(iso, locale, true);
  }
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
  const locale = coercePreferredLanguage(language);
  if (locale === "tt" || locale === "kk") {
    return formatManualCalendarDate(iso, locale, false);
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parseIsoDateLocal(iso));
}
