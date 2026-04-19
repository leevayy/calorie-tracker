import { z } from "zod";
import { FoodMacrosSchema, IsoDateSchema, MealTypeSchema } from "./common.ts";

export const FoodEntryResponseSchema = FoodMacrosSchema.extend({
  id: z.string().uuid(),
  mealType: MealTypeSchema,
  day: IsoDateSchema,
  /** Server-derived normalized slug for tips / habits. */
  mealSlug: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
});
export type FoodEntryResponse = z.infer<typeof FoodEntryResponseSchema>;

/** Use with `POST /days/:day/entries` — `day` comes from the path. */
export const CreateFoodEntryBodySchema = FoodMacrosSchema.extend({
  mealType: MealTypeSchema,
  /** Optional: precomputed slug from the parse-food step; server re-validates and derives one if missing. */
  mealSlug: z.string().min(1).optional(),
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

/** `GET /frequent-foods?from=&to=&limit=` — counts identical `name` per entry row in range. */
export const FrequentFoodsQuerySchema = z.object({
  from: IsoDateSchema,
  to: IsoDateSchema,
  limit: z.coerce.number().int().min(1).max(20).optional().default(3),
});
export type FrequentFoodsQuery = z.infer<typeof FrequentFoodsQuerySchema>;

export const FrequentFoodItemSchema = z.object({
  name: z.string().min(1),
  count: z.number().int().positive(),
});
export type FrequentFoodItem = z.infer<typeof FrequentFoodItemSchema>;

export const FrequentFoodsResponseSchema = z.object({
  items: z.array(FrequentFoodItemSchema),
});
export type FrequentFoodsResponse = z.infer<typeof FrequentFoodsResponseSchema>;
