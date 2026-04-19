import { describe, expect, it } from "vitest";
import { pickPrimaryInsight } from "./insights.ts";
import type { BehaviorSignals, TipContext } from "./types.ts";

function baseContext(over: Partial<TipContext>): TipContext {
  return {
    date: "2026-04-12",
    consumedCalories: 1200,
    calorieGoal: 2000,
    proteinG: 50,
    carbsG: 100,
    fatsG: 40,
    weeklyAverageCalories: 1900,
    communityAvgCalories: null,
    clientTimeZone: "Europe/Moscow",
    localTimeHm: "14:00",
    preferredLanguage: "en",
    nutritionGoal: "maintain",
    recentLogs: [],
    ...over,
  };
}

function baseSignals(over: Partial<BehaviorSignals>): BehaviorSignals {
  return {
    hoursSinceLastMeal: 3,
    mealsToday: 2,
    lastMealCalories: 400,
    justAteRecently: false,
    avgProteinRecent: 25,
    lowProteinStreak: false,
    lateDayEatingPattern: false,
    undereatingTrend: false,
    erraticEating: false,
    ...over,
  };
}

describe("pickPrimaryInsight", () => {
  it("prefers post_meal_large when last meal was big and recent", () => {
    const ctx = baseContext({
      calorieGoal: 2000,
      recentLogs: [{ timestamp: new Date().toISOString(), calories: 900, proteinG: 30 }],
    });
    const sig = baseSignals({
      justAteRecently: true,
      lastMealCalories: 900,
      hoursSinceLastMeal: 0.5,
    });
    const p = pickPrimaryInsight(ctx, sig, 0.6, "day");
    expect(p.type).toBe("post_meal_large");
  });

  it("returns late_night_context in late night", () => {
    const ctx = baseContext({ recentLogs: [{ timestamp: new Date().toISOString(), calories: 100 }] });
    const sig = baseSignals({ justAteRecently: true, lastMealCalories: 100 });
    const p = pickPrimaryInsight(ctx, sig, 0.2, "late_night");
    expect(p.type).toBe("late_night_context");
  });
});
