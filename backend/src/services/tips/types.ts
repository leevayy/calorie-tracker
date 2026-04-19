import type { NutritionGoal, PreferredLanguage } from "../../contracts/common.ts";

export type DayPhase = "late_night" | "morning" | "day" | "evening";

export type RecentLog = {
  timestamp: string;
  calories: number;
  proteinG?: number;
  carbsG?: number;
  fatsG?: number;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  name?: string;
  mealSlug?: string | null;
};

export type TipContext = {
  date: string;
  consumedCalories: number;
  calorieGoal: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
  weeklyAverageCalories: number | null;
  communityAvgCalories: number | null;
  clientTimeZone: string;
  localTimeHm: string;
  preferredLanguage: PreferredLanguage;
  nutritionGoal: NutritionGoal;
  recentLogs: RecentLog[];
};

export type BehaviorSignals = {
  hoursSinceLastMeal: number | null;
  mealsToday: number;
  lastMealCalories: number | null;
  /** True when last log was within the last hour. */
  justAteRecently: boolean;
  avgProteinRecent: number | null;
  lowProteinStreak: boolean;
  lateDayEatingPattern: boolean;
  undereatingTrend: boolean;
  erraticEating: boolean;
};

export type PrimaryInsight = {
  type: string;
  confidence: number;
};
