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
});
