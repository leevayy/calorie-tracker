import { describe, expect, it } from "vitest";
import { buildNutritionParserSystem } from "./ai.ts";

describe("food parser timing prompt", () => {
  it("separates explicit calendar-relative dates from the app's late-night default day", () => {
    const prompt = buildNutritionParserSystem("ru", "maintain", {
      localDate: "2026-08-15",
      localTimeHm: "00:12",
      clientTimeZone: "Europe/Moscow",
      defaultLogDay: "2026-08-14",
      defaultMealType: "snack",
    });

    expect(prompt).toContain("current local calendar date and wall-clock time are 2026-08-15 00:12");
    expect(prompt).toContain('IANA zone "Europe/Moscow"');
    expect(prompt).toContain('"Yesterday" is the previous calendar date even shortly after midnight');
    expect(prompt).toContain("default logging day: 2026-08-14");
    expect(prompt).toContain("default meal: snack");
    expect(prompt).toContain("завтрак/обед/ужин/перекус");
    expect(prompt).toContain("16:00–21:59 dinner");
  });

  it("gives explicit portions, calories, and nutrients priority over estimates", () => {
    const prompt = buildNutritionParserSystem("en", "maintain");

    expect(prompt).toContain("EXPLICIT USER VALUES HAVE HIGHEST PRIORITY");
    expect(prompt).toContain(
      "Preserve every explicit portion, calorie, protein, carbohydrate, fat, and fiber value",
    );
    expect(prompt).toContain("Never replace, normalize, scale, or \"correct\" an explicit user value");
    expect(prompt).toContain("Estimate only values the user omitted");
  });
});
