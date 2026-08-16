import { z } from "zod";
import { FoodMacrosSchema, IsoDateSchema, MealTypeSchema } from "./common.ts";

export const FoodEntryResponseSchema = FoodMacrosSchema.extend({
  id: z.string().uuid(),
  mealType: MealTypeSchema,
  day: IsoDateSchema,
  /** Server-derived normalized slug for grouping and historical reuse. */
  mealSlug: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
});
export type FoodEntryResponse = z.infer<typeof FoodEntryResponseSchema>;

/** One entry in an atomic `POST /entries/batch` logging submission. */
export const CreateFoodEntryRequestSchema = FoodMacrosSchema.extend({
  day: IsoDateSchema,
  mealType: MealTypeSchema,
  /** Optional: precomputed slug from the parse-food step; server re-validates and derives one if missing. */
  mealSlug: z.string().min(1).optional(),
});
export type CreateFoodEntryRequest = z.infer<typeof CreateFoodEntryRequestSchema>;

/** `POST /entries/batch` — all entries are persisted atomically, even across days/meals. */
export const CreateFoodEntriesBodySchema = z.object({
  entries: z.array(CreateFoodEntryRequestSchema).min(1),
});
export type CreateFoodEntriesBody = z.infer<typeof CreateFoodEntriesBodySchema>;

export const CreateFoodEntriesResponseSchema = z.object({
  entries: z.array(FoodEntryResponseSchema).min(1),
});
export type CreateFoodEntriesResponse = z.infer<typeof CreateFoodEntriesResponseSchema>;

/** `POST /meals/duplicate` — copies one owned meal to an explicit day/meal atomically. */
export const DuplicateMealBodySchema = z.object({
  sourceDay: IsoDateSchema,
  sourceMealType: MealTypeSchema,
  destinationDay: IsoDateSchema,
  destinationMealType: MealTypeSchema,
});
export type DuplicateMealBody = z.infer<typeof DuplicateMealBodySchema>;

export const DuplicateMealResponseSchema = z.object({
  entries: z.array(FoodEntryResponseSchema).min(1),
});
export type DuplicateMealResponse = z.infer<typeof DuplicateMealResponseSchema>;

/** `DELETE /entries/batch` — reverses one atomically-created logging submission. */
export const DeleteFoodEntriesBodySchema = z.object({
  entryIds: z.array(z.string().uuid()).min(1),
});
export type DeleteFoodEntriesBody = z.infer<typeof DeleteFoodEntriesBodySchema>;

export const DeleteFoodEntriesResponseSchema = z.object({
  entries: z.array(FoodEntryResponseSchema).min(1),
});
export type DeleteFoodEntriesResponse = z.infer<typeof DeleteFoodEntriesResponseSchema>;

/** `PATCH /entries/:entryId` — full editable replacement; `mealSlug` is server-derived. */
export const UpdateFoodEntryBodySchema = FoodMacrosSchema.extend({
  day: IsoDateSchema,
  mealType: MealTypeSchema,
});
export type UpdateFoodEntryBody = z.infer<typeof UpdateFoodEntryBodySchema>;

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

/** `GET /food-suggestions?query=&limit=` — exact historical configurations ranked for reuse. */
export const HistoricalFoodSuggestionsQuerySchema = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).optional().default(8),
});
export type HistoricalFoodSuggestionsQuery = z.infer<
  typeof HistoricalFoodSuggestionsQuerySchema
>;

export const HistoricalFoodSuggestionSchema = FoodMacrosSchema.extend({
  /** Stored slug lets reuse skip the AI slug-resolution request too. */
  mealSlug: z.string().min(1).optional(),
  usageCount: z.number().int().positive(),
  lastUsedDay: IsoDateSchema,
});
export type HistoricalFoodSuggestion = z.infer<typeof HistoricalFoodSuggestionSchema>;

export const HistoricalFoodSuggestionsResponseSchema = z.object({
  items: z.array(HistoricalFoodSuggestionSchema),
});
export type HistoricalFoodSuggestionsResponse = z.infer<
  typeof HistoricalFoodSuggestionsResponseSchema
>;
