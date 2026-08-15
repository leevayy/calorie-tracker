import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DayLogResponse,
  DuplicateMealBody,
  FoodEntryResponse,
  UpdateFoodEntryBody,
} from "@contracts/food-log";
import type { HistoryRangeResponse } from "@contracts/history";
import { RootStore } from "./rootStore";

const api = vi.hoisted(() => ({
  apiCreateFoodEntry: vi.fn(),
  apiCreateFoodEntries: vi.fn(),
  apiDeleteFoodEntry: vi.fn(),
  apiDeleteFoodEntries: vi.fn(),
  apiDuplicateMeal: vi.fn(),
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createStore() {
  return RootStore.create({
    session: {},
    profile: { read: {}, patch: {} },
    foodLog: {
      dayRead: { day: day.day, data: day, fetchState: "success" },
      entryCreate: {},
      entriesCreate: {},
      entryUpdate: {},
      entryDelete: {},
      frequentWeekRead: {},
    },
    history: { data: history, today: "2026-08-15", fetchState: "success" },
    aiParse: {},
  });
}

beforeEach(() => vi.clearAllMocks());

describe("food entry mutation stores", () => {
  it("allows consecutive recognized groups to save while an earlier group is pending", async () => {
    const first = deferred<{ entries: FoodEntryResponse[] }>();
    const second = deferred<{ entries: FoodEntryResponse[] }>();
    api.apiCreateFoodEntries
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const store = createStore();
    const request = [{
      day: before.day,
      mealType: before.mealType,
      name: before.name,
      calories: before.calories,
      protein: before.protein,
      carbs: before.carbs,
      fats: before.fats,
      fiber: before.fiber,
      portion: before.portion,
    }];

    const firstSave = store.foodLog.entriesCreate.create(request);
    const secondSave = store.foodLog.entriesCreate.create(request);

    expect(api.apiCreateFoodEntries).toHaveBeenCalledTimes(2);
    expect(store.foodLog.entriesCreate.isLoading).toBe(true);
    first.resolve({ entries: [{ ...before, id: "22222222-2222-4222-8222-222222222222" }] });
    second.resolve({ entries: [{ ...before, id: "33333333-3333-4333-8333-333333333333" }] });
    await Promise.all([firstSave, secondSave]);
    expect(store.foodLog.entriesCreate.isLoading).toBe(false);
  });

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

  it("applies an atomically duplicated meal to mounted destination totals", async () => {
    const copied = [
      {
        ...before,
        id: "22222222-2222-4222-8222-222222222222",
        day: "2026-08-16",
        mealType: "lunch" as const,
      },
      {
        ...before,
        id: "33333333-3333-4333-8333-333333333333",
        day: "2026-08-16",
        mealType: "lunch" as const,
        name: "Banana",
        calories: 90,
      },
    ];
    const request: DuplicateMealBody = {
      sourceDay: "2026-08-15",
      sourceMealType: "breakfast",
      destinationDay: "2026-08-16",
      destinationMealType: "lunch",
    };
    api.apiDuplicateMeal.mockResolvedValue({ entries: copied });
    const store = createStore();

    const result = await store.foodLog.mealDuplicate.duplicate(request);

    expect(result).toEqual({ entries: copied });
    expect(store.foodLog.dayRead.data?.meals.breakfast).toEqual([before]);
    expect(store.history.data?.days[1]).toMatchObject({
      calories: 190,
      protein: before.protein * 2,
      carbs: before.carbs * 2,
      fats: before.fats * 2,
      fiber: before.fiber * 2,
    });
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

  it("rolls back every optimistic removal when grouped undo fails", async () => {
    const second = {
      ...before,
      id: "22222222-2222-4222-8222-222222222222",
      name: "Banana",
      calories: 90,
    };
    const store = createStore();
    store.foodLog.dayRead.setData({
      ...day,
      totalCalories: before.calories + second.calories,
      meals: { ...day.meals, breakfast: [before, second] },
    });
    api.apiDeleteFoodEntries.mockRejectedValue(new Error("offline"));

    const result = await store.foodLog.entryDelete.removeMany([before, second]);

    expect(result).toBeUndefined();
    expect(store.foodLog.dayRead.data?.meals.breakfast).toEqual([before, second]);
  });
});
