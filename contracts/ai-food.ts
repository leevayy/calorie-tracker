import { z } from "zod";
import { FoodMacrosSchema, PreferredLanguageSchema } from "./common.ts";

export const ParseFoodRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  preferredLanguage: PreferredLanguageSchema,
});
export type ParseFoodRequest = z.infer<typeof ParseFoodRequestSchema>;

/** LLM / nutrition pipeline output row; matches FoodSuggestion UI. */
export const ParsedFoodSuggestionSchema = FoodMacrosSchema.extend({
  portion: z.string().min(1),
});
export type ParsedFoodSuggestion = z.infer<typeof ParsedFoodSuggestionSchema>;

export const ParseFoodResponseSchema = z.object({
  suggestions: z.array(ParsedFoodSuggestionSchema),
});
export type ParseFoodResponse = z.infer<typeof ParseFoodResponseSchema>;
