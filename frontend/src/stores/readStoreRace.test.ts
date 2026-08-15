import { beforeEach, describe, expect, it, vi } from "vitest";
import { DayLogReadStore } from "./dayLogReadStore";
import { HistoricalFoodSuggestionsStore } from "./historicalFoodSuggestionsStore";

const api = vi.hoisted(() => ({
  apiGetDayLog: vi.fn(),
  apiGetHistoricalFoodSuggestions: vi.fn(),
}));

vi.mock("@/api/foodLog", () => api);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function day(day: string) {
  return {
    day,
    calorieGoal: 2_000,
    totalCalories: 0,
    meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("read-store request ordering", () => {
  it("does not let a slower previous-day response replace the latest selected day", async () => {
    const previous = deferred<ReturnType<typeof day>>();
    const next = deferred<ReturnType<typeof day>>();
    api.apiGetDayLog.mockReturnValueOnce(previous.promise).mockReturnValueOnce(next.promise);
    const store = DayLogReadStore.create({});

    const previousLoad = store.loadDay("2026-08-14");
    const nextLoad = store.loadDay("2026-08-15");
    next.resolve(day("2026-08-15"));
    await nextLoad;
    previous.resolve(day("2026-08-14"));
    await previousLoad;

    expect(store.day).toBe("2026-08-15");
    expect(store.data?.day).toBe("2026-08-15");
  });

  it("does not let an older search overwrite suggestions for newer input", async () => {
    const older = deferred<{ items: [] }>();
    const newer = deferred<{ items: [] }>();
    api.apiGetHistoricalFoodSuggestions
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    const store = HistoricalFoodSuggestionsStore.create({});

    const olderLoad = store.load("gre");
    const newerLoad = store.load("greek");
    newer.resolve({ items: [] });
    await newerLoad;
    older.resolve({ items: [] });
    await olderLoad;

    expect(store.query).toBe("greek");
    expect(store.fetchState).toBe("success");
  });
});
