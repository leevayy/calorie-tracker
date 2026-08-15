import { z } from "zod";
import {
  FoodMacrosSchema,
  IsoDateSchema,
  MealTypeSchema,
  PreferredLanguageSchema,
} from "./common.ts";

const LocalTimeHmSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

export const ParseFoodRequestSchema = z.object({
  text: z.string().min(1).max(10000),
  preferredLanguage: PreferredLanguageSchema,
  /** User-device calendar date used to resolve explicit relative phrases such as "yesterday". */
  localDate: IsoDateSchema,
  /** User-device wall-clock time, included so the model can understand phrases such as "this morning". */
  localTimeHm: LocalTimeHmSchema,
  /** IANA time zone for unambiguous timing context. */
  clientTimeZone: z.string().min(1).max(120),
  /** App's current logging day (which may start later than calendar midnight). */
  defaultLogDay: IsoDateSchema,
  /** Meal bucket to use when the input does not name one. */
  defaultMealType: MealTypeSchema,
});
export type ParseFoodRequest = z.infer<typeof ParseFoodRequestSchema>;

/** LLM / nutrition pipeline output row; matches FoodSuggestion UI. */
export const ParsedFoodSuggestionSchema = FoodMacrosSchema.extend({
  portion: z.string().min(1),
  /** Resolved local calendar day this food should be logged under. */
  day: IsoDateSchema,
  /** Resolved meal bucket this food should be logged under. */
  mealType: MealTypeSchema,
  /** Optional: model's brief portion/macro reasoning (not the primary title). */
  description: z.string().optional(),
  /** Optional: model self-reported estimate confidence, 0–1. */
  confidence: z.number().min(0).max(1).optional(),
  /** Optional: normalized meal slug derived inline by the parse-food model; structurally validated server-side. */
  mealSlug: z.string().min(1).optional(),
});
export type ParsedFoodSuggestion = z.infer<typeof ParsedFoodSuggestionSchema>;

export const ParseFoodResponseSchema = z.object({
  suggestions: z.array(ParsedFoodSuggestionSchema),
});
export type ParseFoodResponse = z.infer<typeof ParseFoodResponseSchema>;
