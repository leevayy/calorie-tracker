import { describe, expect, it } from "vitest";
import { habitSlugCountsFromSlugs, pickSuggestion } from "./mealTemplates.ts";

describe("mealTemplates", () => {
  it("pickSuggestion returns null when budget too small", () => {
    expect(pickSuggestion(100, {})).toBeNull();
  });

  it("pickSuggestion returns English fragment when budget fits", () => {
    const s = pickSuggestion(500, { "chicken-salad": 2 });
    expect(s).toContain("kcal");
  });

  it("habitSlugCountsFromSlugs skips unknown", () => {
    expect(habitSlugCountsFromSlugs(["chicken-salad", "unknown", null])).toEqual({
      "chicken-salad": 1,
    });
  });
});
