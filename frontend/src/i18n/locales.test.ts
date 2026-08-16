import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

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

describe("English and Russian locale contracts", () => {
  it("keeps leaf keys and interpolation placeholders in parity", () => {
    const english = flatten(en);
    const russian = flatten(ru);
    expect(Object.keys(russian).sort()).toEqual(Object.keys(english).sort());

    for (const key of Object.keys(english)) {
      expect(placeholders(russian[key]), key).toEqual(placeholders(english[key]));
    }
  });
});
