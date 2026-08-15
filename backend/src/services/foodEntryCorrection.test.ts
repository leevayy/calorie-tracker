import { describe, expect, test } from "vitest";
import { ZodError } from "zod";
import {
  FoodEntryCorrectionRejectedError,
  proposeFoodEntryCorrection,
} from "./foodEntryCorrection.ts";

const currentEntry = {
  name: "Oatmeal",
  portion: "1 bowl",
  calories: 320,
  protein: 14,
  carbs: 52,
  fats: 7,
  fiber: 8,
  day: "2026-08-15",
  mealType: "breakfast" as const,
};

describe("food entry correction", () => {
  test("applies proportional nutrition scaling in application code", async () => {
    const result = await proposeFoodEntryCorrection(
      currentEntry,
      { instruction: "Double the calories", preferredLanguage: "en" },
      async () => ({ kind: "scale", factor: 2 }),
    );

    expect(result).toEqual({
      draft: {
        name: "Oatmeal",
        portion: "1 bowl",
        calories: 640,
        protein: 28,
        carbs: 104,
        fats: 14,
        fiber: 16,
        day: "2026-08-15",
        mealType: "breakfast",
      },
    });
  });

  test("merges a schema-validated field correction into a complete editable draft", async () => {
    const result = await proposeFoodEntryCorrection(
      currentEntry,
      { instruction: "This was steel-cut oats and 300 calories", preferredLanguage: "en" },
      async () => ({
        kind: "patch",
        changes: { name: "Steel-cut oats", calories: 300 },
      }),
    );

    expect(result).toEqual({
      draft: {
        name: "Steel-cut oats",
        portion: "1 bowl",
        calories: 300,
        protein: 14,
        carbs: 52,
        fats: 7,
        fiber: 8,
        day: "2026-08-15",
        mealType: "breakfast",
      },
    });
  });

  test("changes portion during scaling only when the classified operation includes it", async () => {
    const result = await proposeFoodEntryCorrection(
      currentEntry,
      { instruction: "I ate two bowls", preferredLanguage: "en" },
      async () => ({ kind: "scale", factor: 2, portion: "2 bowls" }),
    );

    expect(result.draft).toEqual({
      ...currentEntry,
      portion: "2 bowls",
      calories: 640,
      protein: 28,
      carbs: 104,
      fats: 14,
      fiber: 16,
    });
  });

  test("rejects an ambiguous instruction without producing a draft", async () => {
    await expect(
      proposeFoodEntryCorrection(
        currentEntry,
        { instruction: "Make it right", preferredLanguage: "en" },
        async () => ({ kind: "reject", reason: "ambiguous" }),
      ),
    ).rejects.toBeInstanceOf(FoodEntryCorrectionRejectedError);
  });

  test("normalizes proportional arithmetic without floating-point residue", async () => {
    const result = await proposeFoodEntryCorrection(
      {
        ...currentEntry,
        calories: 100.1,
        protein: 0.1,
        carbs: 1.1,
        fats: 2.2,
        fiber: 3.3,
      },
      { instruction: "Triple it", preferredLanguage: "en" },
      async () => ({ kind: "scale", factor: 3 }),
    );

    expect(result.draft).toMatchObject({
      calories: 300.3,
      protein: 0.3,
      carbs: 3.3,
      fats: 6.6,
      fiber: 9.9,
    });
  });

  test("does not allow AI output to change the explicit day or meal selectors", async () => {
    await expect(
      proposeFoodEntryCorrection(
        currentEntry,
        { instruction: "Move this to dinner", preferredLanguage: "en" },
        async () => ({
          kind: "patch",
          changes: { day: "2026-08-16", mealType: "dinner" },
        }),
      ),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
