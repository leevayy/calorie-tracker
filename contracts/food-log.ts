import { z } from "zod";
import { FoodMacrosSchema, IsoDateSchema, MealTypeSchema } from "./common.ts";

export const FoodEntryResponseSchema = FoodMacrosSchema.extend({
  id: z.string().uuid(),
  mealType: MealTypeSchema,
  day: IsoDateSchema,
  createdAt: z.string().datetime(),
});
export type FoodEntryResponse = z.infer<typeof FoodEntryResponseSchema>;

/** Use with `POST /days/:day/entries` — `day` comes from the path. */
export const CreateFoodEntryBodySchema = FoodMacrosSchema.extend({
  mealType: MealTypeSchema,
});
export type CreateFoodEntryBody = z.infer<typeof CreateFoodEntryBodySchema>;

/** Client bundle when calling a single `POST /log`-style endpoint that accepts `day` in the body. */
export const CreateFoodEntryRequestSchema = CreateFoodEntryBodySchema.extend({
  day: IsoDateSchema,
});
export type CreateFoodEntryRequest = z.infer<typeof CreateFoodEntryRequestSchema>;

const mealBucketsSchema = z.object({
  breakfast: z.array(FoodEntryResponseSchema),
  lunch: z.array(FoodEntryResponseSchema),
  dinner: z.array(FoodEntryResponseSchema),
  snack: z.array(FoodEntryResponseSchema).optional(),
});

export const DayLogResponseSchema = z.object({
  day: IsoDateSchema,
  calorieGoal: z.number().positive(),
  totalCalories: z.number().nonnegative(),
  meals: mealBucketsSchema,
});
export type DayLogResponse = z.infer<typeof DayLogResponseSchema>;
