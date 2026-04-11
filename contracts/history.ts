import { z } from "zod";
import { IsoDateSchema } from "./common.ts";

export const DailyHistoryPointSchema = z.object({
  date: IsoDateSchema,
  calories: z.number().nonnegative(),
  goal: z.number().positive(),
  /** Grams consumed that day (0 if omitted — старые ответы API без макросов) */
  protein: z.number().nonnegative().default(0),
  carbs: z.number().nonnegative().default(0),
  fats: z.number().nonnegative().default(0),
});
export type DailyHistoryPoint = z.infer<typeof DailyHistoryPointSchema>;

export const HistoryRangeResponseSchema = z.object({
  from: IsoDateSchema,
  to: IsoDateSchema,
  days: z.array(DailyHistoryPointSchema),
  weeklyAverageCalories: z.number().nonnegative().optional(),
});
export type HistoryRangeResponse = z.infer<typeof HistoryRangeResponseSchema>;

export const HistoryQuerySchema = z.object({
  from: IsoDateSchema,
  to: IsoDateSchema,
  /** Client's local calendar date (YYYY-MM-DD); excluded from the average along with empty days. */
  today: IsoDateSchema.optional(),
});
export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;
