import { z } from "zod";

/** UI + AI response locale (matches app i18n resources). */
export const PreferredLanguageSchema = z.enum(["en", "ru", "pl", "tt", "kk"]);
export type PreferredLanguage = z.infer<typeof PreferredLanguageSchema>;

/** User-selected nutrition target; steers parse-food estimation hints. */
export const NutritionGoalSchema = z.enum(["maintain", "muscle_gain", "fat_loss", "recomposition"]);
export type NutritionGoal = z.infer<typeof NutritionGoalSchema>;

/** Internal server model alias used to route AI requests. */
export const AiModelPreferenceSchema = z.enum([
  "alicegpt",
  "aliceflash",
  "deepseek",
  "qwen36",
  "qwen3",
  "gptoss120",
  "gptoss",
]);
export type AiModelPreference = z.infer<typeof AiModelPreferenceSchema>;

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
  fiberG: z.number().nonnegative(),
});
export type Macros = z.infer<typeof MacrosSchema>;

export const FoodMacrosSchema = z.object({
  name: z.string().trim().min(1),
  calories: z.number().finite().nonnegative(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fats: z.number().finite().nonnegative(),
  /** Dietary fiber (grams). */
  fiber: z.number().finite().nonnegative(),
  portion: z.string().trim().min(1).optional(),
});
export type FoodMacros = z.infer<typeof FoodMacrosSchema>;
