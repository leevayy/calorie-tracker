import {
  ERRATIC_CAL_CV,
  ERRATIC_GAP_STDEV_H,
  LATE_CAL_FRACTION,
  LATE_LOCAL_HOUR,
  PROTEIN_LOW_G,
  UNDER_EAT_GOAL_RATIO,
} from "./constants.ts";
import type { BehaviorSignals, TipContext } from "./types.ts";

function localCalendarFields(
  instant: Date,
  timeZone: string,
): { ymd: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const y = map.year ?? "1970";
  const mo = map.month ?? "01";
  const d = map.day ?? "01";
  return {
    ymd: `${y}-${mo}-${d}`,
    hour: Number.parseInt(map.hour ?? "0", 10),
    minute: Number.parseInt(map.minute ?? "0", 10),
  };
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  return Math.sqrt(mean(nums.map((x) => (x - m) ** 2)));
}

export function deriveBehaviorSignals(context: TipContext, now: Date = new Date()): BehaviorSignals {
  const logs = [...context.recentLogs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const tz = context.clientTimeZone;

  if (logs.length === 0) {
    return {
      hoursSinceLastMeal: null,
      mealsToday: 0,
      lastMealCalories: null,
      justAteRecently: false,
      avgProteinRecent: null,
      lowProteinStreak: false,
      lateDayEatingPattern: false,
      undereatingTrend: false,
      erraticEating: false,
    };
  }

  const last = logs[logs.length - 1]!;
  const lastTs = new Date(last.timestamp);
  const hoursSinceLastMeal = Number.isFinite(lastTs.getTime())
    ? Math.max(0, (now.getTime() - lastTs.getTime()) / 3_600_000)
    : null;

  const justAteRecently = hoursSinceLastMeal !== null && hoursSinceLastMeal < 1;

  let mealsToday = 0;
  for (const log of logs) {
    const { ymd } = localCalendarFields(new Date(log.timestamp), tz);
    if (ymd === context.date) mealsToday += 1;
  }

  const proteinVals = logs
    .map((l) => (typeof l.proteinG === "number" && Number.isFinite(l.proteinG) ? l.proteinG : null))
    .filter((x): x is number => x !== null);
  const avgProteinRecent = proteinVals.length > 0 ? mean(proteinVals) : null;

  const lastDesc = [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const lastThreeProt = lastDesc
    .slice(0, 3)
    .map((l) => (typeof l.proteinG === "number" && Number.isFinite(l.proteinG) ? l.proteinG : null))
    .filter((x): x is number => x !== null);
  let lowProteinStreak = false;
  if (lastThreeProt.length >= 2) {
    const check = lastThreeProt.slice(0, Math.min(3, lastThreeProt.length));
    lowProteinStreak = check.length >= 2 && check.every((p) => p < PROTEIN_LOW_G);
  }

  let totalCals = 0;
  let lateCals = 0;
  for (const log of logs) {
    const { hour } = localCalendarFields(new Date(log.timestamp), tz);
    totalCals += log.calories;
    if (hour >= LATE_LOCAL_HOUR) lateCals += log.calories;
  }
  const lateDayEatingPattern = totalCals >= 400 && lateCals / totalCals >= LATE_CAL_FRACTION;

  let undereatingTrend = false;
  if (
    context.weeklyAverageCalories !== null &&
    context.weeklyAverageCalories < context.calorieGoal * UNDER_EAT_GOAL_RATIO
  ) {
    undereatingTrend = true;
  } else {
    const byDay = new Map<string, number>();
    for (const log of logs) {
      const { ymd } = localCalendarFields(new Date(log.timestamp), tz);
      byDay.set(ymd, (byDay.get(ymd) ?? 0) + log.calories);
    }
    const dailyTotals = [...byDay.values()];
    if (dailyTotals.length >= 2) {
      const avgDay = mean(dailyTotals);
      if (avgDay < context.calorieGoal * 0.75) undereatingTrend = true;
    }
  }

  let erraticEating = false;
  if (logs.length >= 4) {
    const calsOnly = logs.map((l) => l.calories);
    const m = mean(calsOnly);
    const cv = m > 0 ? stdDev(calsOnly) / m : 0;
    if (cv >= ERRATIC_CAL_CV) erraticEating = true;
  }
  if (!erraticEating && logs.length >= 3) {
    const sorted = [...logs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const gapsH: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const dt =
        (new Date(sorted[i]!.timestamp).getTime() - new Date(sorted[i - 1]!.timestamp).getTime()) /
        3_600_000;
      if (Number.isFinite(dt) && dt > 0) gapsH.push(dt);
    }
    if (gapsH.length >= 2 && stdDev(gapsH) >= ERRATIC_GAP_STDEV_H) erraticEating = true;
  }

  return {
    hoursSinceLastMeal,
    mealsToday,
    lastMealCalories: typeof last.calories === "number" ? last.calories : null,
    justAteRecently,
    avgProteinRecent,
    lowProteinStreak,
    lateDayEatingPattern,
    undereatingTrend,
    erraticEating,
  };
}
