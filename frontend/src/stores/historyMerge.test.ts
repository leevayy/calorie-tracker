import { describe, expect, it } from "vitest";
import type { FoodEntryResponse } from "@contracts/food-log";
import type { HistoryRangeResponse } from "@contracts/history";
import { applyHistoryEntryChanges } from "./historyMerge";

const original: FoodEntryResponse = {
  id: "11111111-1111-4111-8111-111111111111",
  day: "2026-08-14",
  mealType: "breakfast",
  name: "Oats",
  calories: 100,
  protein: 5,
  carbs: 15,
  fats: 2,
  fiber: 3,
  portion: "1 bowl",
  createdAt: "2026-08-14T08:00:00.000Z",
};

const history: HistoryRangeResponse = {
  from: "2026-08-14",
  to: "2026-08-15",
  weeklyAverageCalories: 100,
  days: [
    {
      date: "2026-08-14",
      calories: 100,
      goal: 2_000,
      protein: 5,
      carbs: 15,
      fats: 2,
      fiber: 3,
    },
    {
      date: "2026-08-15",
      calories: 200,
      goal: 2_000,
      protein: 10,
      carbs: 20,
      fats: 4,
      fiber: 2,
    },
  ],
};

describe("history entry changes", () => {
  it("updates both source and destination days when an entry moves", () => {
    const moved = {
      ...original,
      day: "2026-08-15",
      mealType: "dinner" as const,
      calories: 150,
      protein: 8,
    };

    const result = applyHistoryEntryChanges(
      history,
      [
        { entry: original, direction: -1 },
        { entry: moved, direction: 1 },
      ],
      "2026-08-15",
    );

    expect(result.days[0]).toMatchObject({ calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 });
    expect(result.days[1]).toMatchObject({ calories: 350, protein: 18 });
    expect(result.weeklyAverageCalories).toBe(0);
  });

  it("removes and restores every nutrition value", () => {
    const deleted = applyHistoryEntryChanges(
      history,
      [{ entry: original, direction: -1 }],
      "2026-08-15",
    );
    const restored = applyHistoryEntryChanges(
      deleted,
      [{ entry: original, direction: 1 }],
      "2026-08-15",
    );

    expect(restored.days).toEqual(history.days);
    expect(restored.weeklyAverageCalories).toBe(history.weeklyAverageCalories);
  });
});
