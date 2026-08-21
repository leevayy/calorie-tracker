import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import kk from "./locales/kk.json";
import pl from "./locales/pl.json";
import ru from "./locales/ru.json";
import tt from "./locales/tt.json";

const locales = { en, ru, pl, tt, kk } as const;

const aeroCopyKeys = [
  "settings.aeroMode",
  "settings.aeroModeHint",
  "settings.aeroModeEnabled",
  "settings.aeroModeDisabled",
  "aero.tagline",
  "aero.authAtmosphere",
  "aero.todayAtmosphere",
  "aero.historyAtmosphere",
  "aero.settingsAtmosphere",
] as const;

function flatten(value: unknown, prefix = "", result: Record<string, string> = {}) {
  if (typeof value === "string") {
    result[prefix] = value;
    return result;
  }
  if (value == null || typeof value !== "object" || Array.isArray(value)) return result;
  for (const [key, child] of Object.entries(value)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, result);
  }
  return result;
}

function placeholders(value: string): string[] {
  return Array.from(value.matchAll(/{{\s*([^}\s]+)\s*}}/g), (match) => match[1]).sort();
}

describe("locale contracts", () => {
  it.each(Object.entries(locales).filter(([code]) => code !== "en"))(
    "%s keeps leaf keys and interpolation placeholders in parity with English",
    (_code, locale) => {
      const english = flatten(en);
      const localized = flatten(locale);
      expect(Object.keys(localized).sort()).toEqual(Object.keys(english).sort());

      for (const key of Object.keys(english)) {
        expect(placeholders(localized[key]), key).toEqual(placeholders(english[key]));
      }
    },
  );

  it.each(Object.entries(locales))("%s defines every Aero copy key", (_code, locale) => {
    const copy = flatten(locale);
    for (const key of aeroCopyKeys) {
      expect(copy[key], key).toBeTypeOf("string");
      expect(copy[key].trim(), key).not.toBe("");
    }
  });

  it.each(Object.entries(locales).filter(([code]) => code !== "en"))(
    "%s does not fall back to English Aero copy",
    (_code, locale) => {
      const english = flatten(en);
      const localized = flatten(locale);
      for (const key of aeroCopyKeys.filter((key) => key !== "settings.aeroMode")) {
        expect(localized[key], key).not.toBe(english[key]);
      }
    },
  );
});
