import { largeMealThresholdCalorieGoal } from "./constants.ts";
import type { BehaviorSignals, DayPhase, PrimaryInsight, TipContext } from "./types.ts";

function confidenceFromLogs(logCount: number, strength: number): number {
  const dataFactor = 0.5 + 0.5 * Math.min(1, logCount / 5);
  return Math.round(Math.min(1, strength * dataFactor) * 100) / 100;
}

/**
 * Single primary insight; priority matches product spec (post-meal, late night, deficit daytime, …).
 */
export function pickPrimaryInsight(
  context: TipContext,
  signals: BehaviorSignals,
  dayFrac: number,
  dayPhase: DayPhase,
): PrimaryInsight {
  const n = context.recentLogs.length;
  const rawDelta = context.calorieGoal - context.consumedCalories;

  const lastCals = signals.lastMealCalories ?? 0;
  const postMealLarge =
    n >= 1 &&
    signals.justAteRecently &&
    lastCals >= largeMealThresholdCalorieGoal(context.calorieGoal);
  if (postMealLarge) {
    return { type: "post_meal_large", confidence: confidenceFromLogs(n, 0.88) };
  }

  if (dayPhase === "late_night") {
    return { type: "late_night_context", confidence: confidenceFromLogs(n, 0.9) };
  }

  const deficitOkPhase = dayPhase === "morning" || dayPhase === "day" || dayPhase === "evening";
  if (deficitOkPhase && dayFrac >= 0.55 && rawDelta > context.calorieGoal * 0.35) {
    return { type: "large_deficit_late_day", confidence: confidenceFromLogs(n, 0.8) };
  }

  const longFast =
    !signals.justAteRecently &&
    n >= 1 &&
    signals.hoursSinceLastMeal !== null &&
    signals.hoursSinceLastMeal >= 12 &&
    dayFrac >= 0.42 &&
    (signals.mealsToday === 0 || signals.hoursSinceLastMeal >= 14);
  const noMealsTodayLate =
    !signals.justAteRecently && n >= 1 && signals.mealsToday === 0 && dayFrac >= 0.45;
  if (longFast || noMealsTodayLate) {
    const strength = noMealsTodayLate && dayFrac >= 0.55 ? 0.92 : longFast ? 0.85 : 0.72;
    return { type: "fasting_late_day", confidence: confidenceFromLogs(n, strength) };
  }

  if (signals.lowProteinStreak) {
    return { type: "low_protein_pattern", confidence: confidenceFromLogs(n, 0.74) };
  }

  if (signals.lateDayEatingPattern) {
    return { type: "late_day_eating", confidence: confidenceFromLogs(n, 0.64) };
  }

  if (signals.undereatingTrend) {
    return { type: "undereating_trend", confidence: confidenceFromLogs(n, 0.62) };
  }

  if (signals.erraticEating) {
    return { type: "erratic_eating", confidence: confidenceFromLogs(n, 0.58) };
  }

  return { type: "goal_balance_generic", confidence: confidenceFromLogs(n, 0.44) };
}
