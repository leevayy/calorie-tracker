import { describe, expect, it } from "vitest";
import type { DayLogResponse, FoodEntryResponse } from "@contracts/food-log";
import {
  mergeFoodEntries,
  mergeFoodEntry,
  removeFoodEntryById,
  replaceFoodEntry,
} from "./foodLogMerge";

function entry(overrides: Partial<FoodEntryResponse> = {}): FoodEntryResponse {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    day: "2026-08-15",
    mealType: "breakfast",
    name: "Oats",
    calories: 100,
    protein: 5,
    carbs: 15,
    fats: 2,
    fiber: 3,
    portion: "1 bowl",
    createdAt: "2026-08-15T08:00:00.000Z",
    ...overrides,
  };
}

function dayLog(entries: FoodEntryResponse[] = [entry()]): DayLogResponse {
  return {
    day: "2026-08-15",
    calorieGoal: 2_000,
    totalCalories: entries.reduce((sum, item) => sum + item.calories, 0),
    meals: {
      breakfast: entries.filter((item) => item.mealType === "breakfast"),
      lunch: entries.filter((item) => item.mealType === "lunch"),
      dinner: entries.filter((item) => item.mealType === "dinner"),
      snack: entries.filter((item) => item.mealType === "snack"),
    },
  };
}

describe("food log merge", () => {
  it("merges all entries for the visible day and recalculates totals", () => {
    const currentDayEntry = entry({
      id: "22222222-2222-4222-8222-222222222222",
      mealType: "lunch",
      calories: 250,
      createdAt: "2026-08-15T12:00:00.000Z",
    });
    const otherDayEntry = entry({
      id: "33333333-3333-4333-8333-333333333333",
      day: "2026-08-14",
      calories: 500,
    });

    const result = mergeFoodEntries(dayLog(), [currentDayEntry, otherDayEntry]);

    expect(result.totalCalories).toBe(350);
    expect(result.meals.lunch).toEqual([currentDayEntry]);
    expect(result.meals.breakfast).toHaveLength(1);
  });

  it("moves an entry between meals without duplicating it", () => {
    const before = entry();
    const after = entry({ mealType: "dinner", calories: 175, name: "Corrected oats" });

    const result = replaceFoodEntry(dayLog([before]), before, after);

    expect(result.meals.breakfast).toEqual([]);
    expect(result.meals.dinner).toEqual([after]);
    expect(result.totalCalories).toBe(175);
    expect(
      Object.values(result.meals).flatMap((bucket) => bucket ?? []).filter((item) => item.id === before.id),
    ).toHaveLength(1);
  });

  it("removes an entry moved away from the visible day", () => {
    const before = entry();
    const after = entry({ day: "2026-08-16", mealType: "lunch" });

    const result = replaceFoodEntry(dayLog([before]), before, after);

    expect(result.totalCalories).toBe(0);
    expect(result.meals.breakfast).toEqual([]);
    expect(result.meals.lunch).toEqual([]);
  });

  it("deletes and restores the complete entry without creating a duplicate", () => {
    const original = entry();
    const deleted = removeFoodEntryById(dayLog([original]), original.id);
    expect(deleted?.totalCalories).toBe(0);

    const restored = mergeFoodEntry(deleted!, original);
    const restoredAgain = mergeFoodEntry(restored, original);

    expect(restoredAgain.meals.breakfast).toEqual([original]);
    expect(restoredAgain.totalCalories).toBe(original.calories);
  });
});
