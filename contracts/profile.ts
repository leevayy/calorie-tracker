import { z } from "zod";
import { UserSummarySchema } from "./auth.ts";
import { NutritionGoalSchema, PreferredLanguageSchema } from "./common.ts";

export const UserProfileResponseSchema = z.object({
  user: UserSummarySchema,
  dailyCalorieGoal: z.number().positive(),
  weightKg: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  preferredLanguage: PreferredLanguageSchema,
  nutritionGoal: NutritionGoalSchema,
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
  })
  .refine((b) => Object.keys(b).length > 0, {
    message: "At least one field required",
  });
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
