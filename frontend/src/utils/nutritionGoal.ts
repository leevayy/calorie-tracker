import { NutritionGoalSchema, type NutritionGoal } from "@contracts/common";

export function coerceNutritionGoal(code: string | undefined): NutritionGoal {
  const parsed = NutritionGoalSchema.safeParse(code);
  return parsed.success ? parsed.data : "maintain";
}

export const NUTRITION_GOAL_OPTIONS: { value: NutritionGoal; labelKey: string }[] = [
  { value: "maintain", labelKey: "goals.maintain" },
  { value: "muscle_gain", labelKey: "goals.muscle_gain" },
  { value: "fat_loss", labelKey: "goals.fat_loss" },
  { value: "recomposition", labelKey: "goals.recomposition" },
];
