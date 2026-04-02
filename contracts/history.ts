import { z } from "zod";
import { IsoDateSchema } from "./common.ts";

export const DailyHistoryPointSchema = z.object({
  date: IsoDateSchema,
  calories: z.number().nonnegative(),
  goal: z.number().positive(),
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
});
export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;
