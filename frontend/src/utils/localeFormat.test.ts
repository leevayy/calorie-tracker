import { describe, expect, it } from "vitest";
import {
  formatInlineCalendarDate,
  formatLocalizedEnergy,
  formatLocalizedGrams,
  formatLocalizedNumber,
  formatStandaloneCalendarDate,
} from "./localeFormat";

describe("locale-aware display formatting", () => {
  it("formats English and Russian decimal values with their locale conventions", () => {
    expect(formatLocalizedNumber(12.5, "en")).toBe("12.5");
    expect(formatLocalizedNumber(12.5, "ru")).toBe("12,5");
    expect(formatLocalizedGrams(12.5, "en")).toBe("12.5\u00a0g");
    expect(formatLocalizedGrams(12.5, "ru")).toBe("12,5\u00a0г");
    expect(formatLocalizedEnergy(320, "ru", "ккал")).toBe("320\u00a0ккал");
  });

  it("capitalizes only the first word of a standalone Russian date", () => {
    const formatted = formatStandaloneCalendarDate("2026-08-15", "ru-RU");
    expect(formatted).toBe("Суббота, 15 августа 2026 г.");
    expect(formatted).not.toContain("Августа");
    expect(formatted).not.toContain("Г.");
  });

  it("omits the weekday from sentence-safe dates", () => {
    expect(formatInlineCalendarDate("2026-08-15", "en")).toBe("August 15, 2026");
    expect(formatInlineCalendarDate("2026-08-15", "ru")).toBe("15 августа 2026 г.");
  });

  it("formats Tatar dates without depending on browser ICU locale coverage", () => {
    expect(formatStandaloneCalendarDate("2039-12-31", "tt")).toBe(
      "31 декабрь, 2039 ел, шимбә",
    );
    expect(formatInlineCalendarDate("2039-12-31", "tt")).toBe(
      "31 декабрь, 2039 ел",
    );
  });

  it("formats Kazakh dates without depending on browser ICU locale coverage", () => {
    expect(formatStandaloneCalendarDate("2039-12-31", "kk")).toBe(
      "2039 жылғы 31 желтоқсан, сенбі",
    );
    expect(formatInlineCalendarDate("2039-12-31", "kk")).toBe(
      "2039 жылғы 31 желтоқсан",
    );
  });
});
