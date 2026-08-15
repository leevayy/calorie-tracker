import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DayLogResponse, FoodEntryResponse, UpdateFoodEntryBody } from "@contracts/food-log";
import type { HistoryRangeResponse } from "@contracts/history";
import { RootStore } from "./rootStore";

const api = vi.hoisted(() => ({
  apiCreateFoodEntry: vi.fn(),
  apiCreateFoodEntries: vi.fn(),
  apiDeleteFoodEntry: vi.fn(),
  apiGetDayLog: vi.fn(),
  apiGetFrequentFoods: vi.fn(),
  apiRestoreFoodEntry: vi.fn(),
  apiUpdateFoodEntry: vi.fn(),
}));

vi.mock("@/api/foodLog", () => api);

const before: FoodEntryResponse = {
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
  mealSlug: "oats",
  createdAt: "2026-08-15T08:00:00.000Z",
};

const day: DayLogResponse = {
  day: "2026-08-15",
  calorieGoal: 2_000,
  totalCalories: before.calories,
  meals: { breakfast: [before], lunch: [], dinner: [], snack: [] },
};

const history: HistoryRangeResponse = {
  from: "2026-08-15",
  to: "2026-08-16",
  weeklyAverageCalories: 0,
  days: [
    {
      date: "2026-08-15",
      calories: before.calories,
      goal: 2_000,
      protein: before.protein,
      carbs: before.carbs,
      fats: before.fats,
      fiber: before.fiber,
    },
    {
      date: "2026-08-16",
      calories: 0,
      goal: 2_000,
      protein: 0,
      carbs: 0,
      fats: 0,
      fiber: 0,
    },
  ],
};

function createStore() {
  return RootStore.create({
    session: {},
    profile: { read: {}, patch: {}, setTipVibe: {} },
    foodLog: {
      dayRead: { day: day.day, data: day, fetchState: "success" },
      entryCreate: {},
      entriesCreate: {},
      entryUpdate: {},
      entryDelete: {},
      frequentWeekRead: {},
    },
    history: { data: history, today: "2026-08-15", fetchState: "success" },
    dailyTip: {},
    aiParse: {},
  });
}

beforeEach(() => vi.clearAllMocks());

describe("food entry mutation stores", () => {
  it("applies a persisted move to the visible source day and mounted history", async () => {
    const after: FoodEntryResponse = {
      ...before,
      day: "2026-08-16",
      mealType: "dinner",
      calories: 175,
      name: "Corrected oats",
      mealSlug: "corrected-oats",
    };
    const body: UpdateFoodEntryBody = {
      day: after.day,
      mealType: after.mealType,
      name: after.name,
      calories: after.calories,
      protein: after.protein,
      carbs: after.carbs,
      fats: after.fats,
      fiber: after.fiber,
      portion: after.portion,
    };
    api.apiUpdateFoodEntry.mockResolvedValue(after);
    const store = createStore();

    await store.foodLog.entryUpdate.update(before, body);

    expect(store.foodLog.dayRead.data?.totalCalories).toBe(0);
    expect(store.foodLog.dayRead.data?.meals.breakfast).toEqual([]);
    expect(store.history.data?.days[0]?.calories).toBe(0);
    expect(store.history.data?.days[1]?.calories).toBe(175);
  });

  it("rolls back its optimistic removal when delete fails", async () => {
    api.apiDeleteFoodEntry.mockRejectedValue(new Error("offline"));
    const store = createStore();

    const result = await store.foodLog.entryDelete.remove(before);

    expect(result).toBeUndefined();
    expect(store.foodLog.dayRead.data?.meals.breakfast).toEqual([before]);
    expect(store.history.data?.days[0]?.calories).toBe(before.calories);
    expect(store.foodLog.entryDelete.fetchState).toBe("error");
  });

  it("restores the complete server entry after a successful delete", async () => {
    api.apiDeleteFoodEntry.mockResolvedValue(before);
    api.apiRestoreFoodEntry.mockResolvedValue(before);
    const store = createStore();

    await store.foodLog.entryDelete.remove(before);
    expect(store.foodLog.dayRead.data?.totalCalories).toBe(0);

    await store.foodLog.entryDelete.restore(before.id);
    expect(store.foodLog.dayRead.data?.meals.breakfast).toEqual([before]);
    expect(store.history.data?.days[0]).toMatchObject({
      calories: before.calories,
      protein: before.protein,
      carbs: before.carbs,
      fats: before.fats,
      fiber: before.fiber,
    });
  });
});
