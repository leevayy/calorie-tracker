import { z } from "zod";
import {
  CorrectFoodEntryResponseSchema,
  type CorrectFoodEntryRequest,
  type CorrectFoodEntryResponse,
} from "../contracts/ai-food.ts";
import type { UpdateFoodEntryBody } from "../contracts/food-log.ts";

const ScaleCorrectionIntentSchema = z
  .object({
    kind: z.literal("scale"),
    factor: z.number().finite().positive().max(100),
    portion: z.string().trim().min(1).optional(),
  })
  .strict();

const FoodEntryPatchSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    portion: z.string().trim().min(1).nullable().optional(),
    calories: z.number().finite().nonnegative().optional(),
    protein: z.number().finite().nonnegative().optional(),
    carbs: z.number().finite().nonnegative().optional(),
    fats: z.number().finite().nonnegative().optional(),
    fiber: z.number().finite().nonnegative().optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: "At least one corrected field is required",
  });

const PatchCorrectionIntentSchema = z
  .object({
    kind: z.literal("patch"),
    changes: FoodEntryPatchSchema,
  })
  .strict();

const RejectCorrectionIntentSchema = z
  .object({
    kind: z.literal("reject"),
    reason: z.enum(["ambiguous", "unsupported", "invalid"]),
  })
  .strict();

const FoodEntryCorrectionIntentSchema = z.discriminatedUnion("kind", [
  ScaleCorrectionIntentSchema,
  PatchCorrectionIntentSchema,
  RejectCorrectionIntentSchema,
]);

export class FoodEntryCorrectionRejectedError extends Error {
  readonly reason: "ambiguous" | "unsupported" | "invalid";

  constructor(reason: "ambiguous" | "unsupported" | "invalid") {
    super("Food entry correction was rejected");
    this.name = "FoodEntryCorrectionRejectedError";
    this.reason = reason;
  }
}

function scaleNutritionValue(value: number, factor: number): number {
  const scaled = value * factor;
  return Math.round(scaled * 1_000_000) / 1_000_000;
}

export type FoodEntryCorrectionClassifierInput = {
  current: UpdateFoodEntryBody;
  instruction: string;
  preferredLanguage: CorrectFoodEntryRequest["preferredLanguage"];
};

export type FoodEntryCorrectionClassifier = (
  input: FoodEntryCorrectionClassifierInput,
) => Promise<unknown>;

export async function proposeFoodEntryCorrection(
  current: UpdateFoodEntryBody,
  request: CorrectFoodEntryRequest,
  classify: FoodEntryCorrectionClassifier,
): Promise<CorrectFoodEntryResponse> {
  const intent = FoodEntryCorrectionIntentSchema.parse(
    await classify({
      current,
      instruction: request.instruction,
      preferredLanguage: request.preferredLanguage,
    }),
  );

  if (intent.kind === "reject") {
    throw new FoodEntryCorrectionRejectedError(intent.reason);
  }

  const draft: UpdateFoodEntryBody =
    intent.kind === "scale"
      ? {
          ...current,
          ...(intent.portion ? { portion: intent.portion } : {}),
          calories: scaleNutritionValue(current.calories, intent.factor),
          protein: scaleNutritionValue(current.protein, intent.factor),
          carbs: scaleNutritionValue(current.carbs, intent.factor),
          fats: scaleNutritionValue(current.fats, intent.factor),
          fiber: scaleNutritionValue(current.fiber, intent.factor),
        }
      : {
          ...current,
          ...intent.changes,
          portion:
            intent.changes.portion === null
              ? undefined
              : (intent.changes.portion ?? current.portion),
        };

  return CorrectFoodEntryResponseSchema.parse({ draft });
}
