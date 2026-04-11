import { z } from "zod";
import { FoodMacrosSchema, PreferredLanguageSchema } from "./common.ts";

export const ParseFoodRequestSchema = z.object({
  text: z.string().min(1).max(10000),
  preferredLanguage: PreferredLanguageSchema,
});
export type ParseFoodRequest = z.infer<typeof ParseFoodRequestSchema>;

/** LLM / nutrition pipeline output row; matches FoodSuggestion UI. */
export const ParsedFoodSuggestionSchema = FoodMacrosSchema.extend({
  portion: z.string().min(1),
  /** Optional: model's brief portion/macro reasoning (not the primary title). */
  description: z.string().optional(),
  /** Optional: model self-reported estimate confidence, 0–1. */
  confidence: z.number().min(0).max(1).optional(),
});
export type ParsedFoodSuggestion = z.infer<typeof ParsedFoodSuggestionSchema>;

export const ParseFoodResponseSchema = z.object({
  suggestions: z.array(ParsedFoodSuggestionSchema),
});
export type ParseFoodResponse = z.infer<typeof ParseFoodResponseSchema>;
