import { z } from "zod";

/** UI + AI response locale (matches app i18n resources). */
export const PreferredLanguageSchema = z.enum(["en", "ru", "pl", "tt", "kk"]);
export type PreferredLanguage = z.infer<typeof PreferredLanguageSchema>;

/** User-selected nutrition target; steers AI tips and food parsing assumptions. */
export const NutritionGoalSchema = z.enum(["maintain", "muscle_gain", "fat_loss", "recomposition"]);
export type NutritionGoal = z.infer<typeof NutritionGoalSchema>;

/** YYYY-MM-DD */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date (YYYY-MM-DD)");

export const MealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export type MealType = z.infer<typeof MealTypeSchema>;

export const MacrosSchema = z.object({
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatsG: z.number().nonnegative(),
});
export type Macros = z.infer<typeof MacrosSchema>;

export const FoodMacrosSchema = z.object({
  name: z.string().min(1),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fats: z.number().nonnegative(),
  portion: z.string().optional(),
});
export type FoodMacros = z.infer<typeof FoodMacrosSchema>;
