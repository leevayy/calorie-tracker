import { describe, expect, it } from "vitest";
import { buildParseFoodTiming, formatLogDayLabel } from "./date";

describe("buildParseFoodTiming", () => {
  it("keeps the calendar date but defaults logging to the previous day shortly after midnight", () => {
    const timing = buildParseFoodTiming(new Date(2026, 7, 15, 0, 12), "Europe/Moscow");

    expect(timing).toEqual({
      localDate: "2026-08-15",
      localTimeHm: "00:12",
      clientTimeZone: "Europe/Moscow",
      defaultLogDay: "2026-08-14",
      defaultMealType: "snack",
    });
  });

  it("uses the current day and time-based meal outside the late-night boundary", () => {
    const timing = buildParseFoodTiming(new Date(2026, 7, 15, 18, 30), "Europe/Moscow");

    expect(timing.defaultLogDay).toBe("2026-08-15");
    expect(timing.defaultMealType).toBe("dinner");
  });
});

describe("formatLogDayLabel", () => {
  it("uses localized relative labels for nearby days", () => {
    expect(formatLogDayLabel("2026-08-14", "2026-08-15", "en")).toBe("Yesterday");
    expect(formatLogDayLabel("2026-08-15", "2026-08-15", "en")).toBe("Today");
  });

  it("uses a calendar label for older days", () => {
    expect(formatLogDayLabel("2026-08-10", "2026-08-15", "en-US")).toBe("Aug 10");
  });
});
