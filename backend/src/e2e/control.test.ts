import { describe, expect, test, vi } from "vitest";
import type { FoodEntryRecord, FoodLogRepository } from "../services/foodLogRepository.ts";
import { createE2EControlRuntime, type E2EControlPersistence } from "./control.ts";

const SECRET = "0123456789abcdef";
const timing = {
  localDate: "2026-08-15",
  localTimeHm: "08:00",
  clientTimeZone: "Europe/Moscow",
  defaultLogDay: "2026-08-15",
  defaultMealType: "breakfast" as const,
};

function runtime(
  persistence: E2EControlPersistence = { resetAndSeed: vi.fn() },
  resetApplicationState?: () => void,
) {
  return createE2EControlRuntime({
    enabled: true,
    nodeEnv: "test",
    secret: SECRET,
    persistence,
    resetApplicationState,
  });
}

function repository(createEntriesAtomic = vi.fn(async (entries) => entries)): FoodLogRepository {
  return {
    findUser: vi.fn(),
    findFrequentFoods: vi.fn(),
    findHistoricalFoodSuggestions: vi.fn(),
    findDayEntries: vi.fn(),
    findActiveEntry: vi.fn(),
    createEntriesAtomic,
    updateEntry: vi.fn(),
    softDeleteEntry: vi.fn(),
    softDeleteEntriesAtomic: vi.fn(),
    restoreEntry: vi.fn(),
  };
}

describe("E2E control activation", () => {
  test.each([
    { enabled: false, nodeEnv: "test" },
    { enabled: true, nodeEnv: "development" },
    { enabled: true, nodeEnv: "production" },
  ])("cannot create a control runtime with $nodeEnv/$enabled", ({ enabled, nodeEnv }) => {
    expect(() =>
      createE2EControlRuntime({
        enabled,
        nodeEnv,
        secret: "0123456789abcdef",
        persistence: { resetAndSeed: vi.fn() },
      }),
    ).toThrow(/explicit E2E test mode/i);
  });
});

describe("deterministic E2E controls", () => {
  test("provides stable success, multi-food, ambiguous, and failure parse modes", async () => {
    const control = runtime();
    const parse = () => control.parseFood("anything", "en", "maintain", "qwen3", timing);

    expect(await parse()).toEqual(await parse());
    control.configureAi({ parseFood: "multi-food" });
    expect(await parse()).toHaveLength(2);
    control.configureAi({ parseFood: "ambiguous" });
    expect(await parse()).toEqual([]);
    control.configureAi({ parseFood: "failure" });
    await expect(parse()).rejects.toThrow(/parse failure/i);
  });

  test("derives explicit nutrition from the submitted description instead of inferred defaults", async () => {
    const control = runtime();
    control.configureAi({ parseFood: "explicit-nutrition" });

    await expect(
      control.parseFood(
        "E2E trail mix, portion 37 g, 913 calories, 17 g protein, 23 g carbs, 29 g fat, 31 g fiber",
        "en",
        "maintain",
        "qwen3",
        timing,
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        name: "E2E trail mix",
        portion: "37 g",
        calories: 913,
        protein: 17,
        carbs: 23,
        fats: 29,
        fiber: 31,
      }),
    ]);
  });

  test("provides delayed, ambiguous, and failed correction modes", async () => {
    vi.useFakeTimers();
    try {
      const control = runtime();
      control.configureAi({ correction: "delay", delayMs: 250 });
      const delayed = control.classifyCorrection({
        current: {
          name: "Oats",
          calories: 300,
          protein: 10,
          carbs: 50,
          fats: 7,
          fiber: 6,
          portion: "1 bowl",
          day: "2026-08-15",
          mealType: "breakfast",
        },
        instruction: "double it",
        preferredLanguage: "en",
      });
      await vi.advanceTimersByTimeAsync(249);
      let settled = false;
      void delayed.finally(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(delayed).resolves.toEqual({
        kind: "scale",
        factor: 2,
        portion: "2 servings",
      });

      control.configureAi({ correction: "ambiguous" });
      await expect(control.classifyCorrection({} as never)).resolves.toEqual({
        kind: "reject",
        reason: "ambiguous",
      });
      control.configureAi({ correction: "failure" });
      await expect(control.classifyCorrection({} as never)).rejects.toThrow(/correction failure/i);
    } finally {
      vi.useRealTimers();
    }
  });

  test("delays only the next historical-suggestion lookup and reset clears the seam", async () => {
    vi.useFakeTimers();
    try {
      const resetAndSeed = vi.fn(async () => ({ users: [] }));
      const control = runtime({ resetAndSeed });
      const lookupOrder: string[] = [];
      const findHistoricalFoodSuggestions = vi.fn(async (_userId, query: string) => {
        lookupOrder.push(query);
        return [];
      });
      const wrapped = control.wrapFoodLogRepository({
        ...repository(),
        findHistoricalFoodSuggestions,
      });

      control.configureNextHistoricalSuggestionDelay(250);
      const first = wrapped.findHistoricalFoodSuggestions("user-1", "first", 5);
      const second = wrapped.findHistoricalFoodSuggestions("user-1", "second", 5);

      await expect(second).resolves.toEqual([]);
      expect(lookupOrder).toEqual(["second"]);
      await vi.advanceTimersByTimeAsync(249);
      expect(lookupOrder).toEqual(["second"]);
      await vi.advanceTimersByTimeAsync(1);
      await expect(first).resolves.toEqual([]);
      expect(lookupOrder).toEqual(["second", "first"]);

      control.configureNextHistoricalSuggestionDelay(250);
      await control.resetAndSeed({ users: [] });
      await expect(
        wrapped.findHistoricalFoodSuggestions("user-1", "after reset", 5),
      ).resolves.toEqual([]);
      expect(lookupOrder).toEqual(["second", "first", "after reset"]);
    } finally {
      vi.useRealTimers();
    }
  });

  test("fails the next batch atomically once and reset clears all in-memory controls", async () => {
    const resetAndSeed = vi.fn(async () => ({ users: [] }));
    const resetApplicationState = vi.fn();
    const control = runtime({ resetAndSeed }, resetApplicationState);
    const createEntriesAtomic = vi.fn(async (entries) => entries);
    const wrapped = control.wrapFoodLogRepository(repository(createEntriesAtomic));
    const records: FoodEntryRecord[] = [];

    control.configureAi({ parseFood: "failure", correction: "failure", delayMs: 500 });
    control.configureNextBatchSaveFailure(true);
    await expect(wrapped.createEntriesAtomic(records)).rejects.toThrow(/batch-save failure/i);
    await expect(wrapped.createEntriesAtomic(records)).resolves.toEqual([]);

    await control.resetAndSeed({ users: [] });
    await expect(
      control.parseFood("anything", "en", "maintain", "qwen3", timing),
    ).resolves.toHaveLength(1);
    await expect(control.classifyCorrection({} as never)).resolves.toMatchObject({
      kind: "scale",
      factor: 2,
    });
    await expect(wrapped.createEntriesAtomic(records)).resolves.toEqual([]);
    expect(resetAndSeed).toHaveBeenCalledWith({ users: [] });
    expect(resetApplicationState).toHaveBeenCalledOnce();
    expect(createEntriesAtomic).toHaveBeenCalledTimes(2);
  });
});
