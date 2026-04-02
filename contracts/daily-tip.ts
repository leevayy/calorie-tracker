import { z } from "zod";
import { IsoDateSchema, MacrosSchema, PreferredLanguageSchema } from "./common.ts";

/** Per-meal item counts for the current day (helps the model reason about structure). */
export const MealsSummarySchema = z.object({
  breakfastItemCount: z.number().int().nonnegative(),
  lunchItemCount: z.number().int().nonnegative(),
  dinnerItemCount: z.number().int().nonnegative(),
  snackItemCount: z.number().int().nonnegative().optional(),
});
export type MealsSummary = z.infer<typeof MealsSummarySchema>;

/**
 * Client → server: authenticated user’s snapshot for “today” so the backend can
 * combine it with profile + historical logs + anonymized community aggregates.
 */
/** Local wall-clock time on `date` (user device), 24h HH:mm. */
const LocalTimeHmSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

export const DailyTipRequestSchema = z.object({
  date: IsoDateSchema,
  caloriesConsumedToday: z.number().nonnegative(),
  calorieGoal: z.number().positive(),
  macrosToday: MacrosSchema,
  mealsSummary: MealsSummarySchema,
  /** IANA zone, e.g. Europe/Moscow — scopes interpretation of `date` + `localTimeHm`. */
  clientTimeZone: z.string().min(1).max(120),
  localTimeHm: LocalTimeHmSchema,
  /** BCP-47-style tag; must match a supported app locale so copy stays consistent. */
  preferredLanguage: PreferredLanguageSchema,
});
export type DailyTipRequest = z.infer<typeof DailyTipRequestSchema>;

export const TipSourceSchema = z.enum([
  "user_today",
  "user_profile",
  "user_history",
  "community_aggregate",
]);
export type TipSource = z.infer<typeof TipSourceSchema>;

/** Optional anonymized peer stats the server derived from all users (same cohort rules are backend-defined). */
export const CommunityTipSnapshotSchema = z.object({
  cohortLabel: z.string().optional(),
  sampleSize: z.number().int().nonnegative(),
  avgCaloriesAtSameUtcOffset: z.number().nonnegative().optional(),
  avgProteinGAtSameUtcOffset: z.number().nonnegative().optional(),
});
export type CommunityTipSnapshot = z.infer<typeof CommunityTipSnapshotSchema>;

export const DailyTipResponseSchema = z.object({
  message: z.string().min(1),
  generatedAt: z.string().datetime(),
  sourcesUsed: z.array(TipSourceSchema).optional(),
  communitySnapshot: CommunityTipSnapshotSchema.optional(),
});
export type DailyTipResponse = z.infer<typeof DailyTipResponseSchema>;
