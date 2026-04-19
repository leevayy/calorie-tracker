import { z } from "zod";
import { UserSummarySchema } from "./auth.ts";
import {
  AiModelPreferenceSchema,
  NutritionGoalSchema,
  PreferredLanguageSchema,
  TIP_VIBE_PROMPT_MAX,
  TipVibeSlotSchema,
} from "./common.ts";

export const UserProfileResponseSchema = z.object({
  user: UserSummarySchema,
  dailyCalorieGoal: z.number().positive(),
  weightKg: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  preferredLanguage: PreferredLanguageSchema,
  nutritionGoal: NutritionGoalSchema,
  aiModelPreference: AiModelPreferenceSchema,
  tipVibePrompt: z.string().max(TIP_VIBE_PROMPT_MAX),
  tipVibeEmoji: z.string().min(1).max(8).nullable(),
  updatedAt: z.string().datetime(),
});
export type UserProfileResponse = z.infer<typeof UserProfileResponseSchema>;

export const UpdateProfileRequestSchema = z
  .object({
    dailyCalorieGoal: z.number().positive().optional(),
    weightKg: z.number().positive().optional(),
    heightCm: z.number().positive().optional(),
    preferredLanguage: PreferredLanguageSchema.optional(),
    nutritionGoal: NutritionGoalSchema.optional(),
    aiModelPreference: AiModelPreferenceSchema.optional(),
    /** When true, clears `tipVibePrompt` and `tipVibeEmoji` (no per-emoji write). */
    clearTipVibe: z.literal(true).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, {
    message: "At least one field required",
  });
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

/**
 * Body for `PUT /me/tip-vibe`. Server stores `prompt` as-is and assigns the displayed emoji:
 * - preset slots → fixed emoji per slot
 * - "custom" → AI picks a single emoji that fits the prompt
 * Empty `prompt` clears the vibe.
 */
export const SetTipVibeRequestSchema = z.object({
  slot: TipVibeSlotSchema,
  prompt: z.string().max(TIP_VIBE_PROMPT_MAX),
});
export type SetTipVibeRequest = z.infer<typeof SetTipVibeRequestSchema>;
