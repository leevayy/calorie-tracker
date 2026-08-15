import { describe, expect, it } from "vitest";
import type { FoodEntryResponse } from "@contracts/food-log";
import { foodEntryDraftFromEntry, parseFoodEntryDraft } from "./foodEntryDraft";

const entry: FoodEntryResponse = {
  id: "11111111-1111-4111-8111-111111111111",
  day: "2026-08-15",
  mealType: "lunch",
  name: "Soup",
  calories: 220,
  protein: 12,
  carbs: 25,
  fats: 8,
  fiber: 4,
  portion: "350 ml",
  mealSlug: "soup",
  createdAt: "2026-08-15T12:00:00.000Z",
};

describe("food entry draft", () => {
  it("populates every editable persisted field", () => {
    expect(foodEntryDraftFromEntry(entry)).toEqual({
      name: "Soup",
      portion: "350 ml",
      calories: "220",
      protein: "12",
      carbs: "25",
      fats: "8",
      fiber: "4",
      day: "2026-08-15",
      mealType: "lunch",
    });
  });

  it("returns field errors for invalid values without changing the draft", () => {
    const draft = {
      ...foodEntryDraftFromEntry(entry),
      name: "  ",
      calories: "-1",
      protein: "not a number",
      day: "15/08/2026",
    };
    const snapshot = { ...draft };

    const result = parseFoodEntryDraft(draft);

    expect(result).toEqual({
      success: false,
      errors: {
        name: "entryEditor.validation.required",
        calories: "entryEditor.validation.nonnegative",
        protein: "entryEditor.validation.number",
        day: "entryEditor.validation.date",
      },
    });
    expect(draft).toEqual(snapshot);
  });

  it("produces a full update body and omits a blank portion", () => {
    const result = parseFoodEntryDraft({
      ...foodEntryDraftFromEntry(entry),
      name: "  Tomato soup  ",
      portion: "   ",
      mealType: "dinner",
      day: "2026-08-16",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      name: "Tomato soup",
      portion: undefined,
      day: "2026-08-16",
      mealType: "dinner",
      calories: 220,
      fiber: 4,
    });
  });
});
