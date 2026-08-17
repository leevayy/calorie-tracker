import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { MealTypeSchema, NutritionGoalSchema, PreferredLanguageSchema } from "../contracts/common.ts";
import {
  assertE2EControlRuntime,
  type E2EControlRuntime,
} from "../e2e/control.ts";
import { sendUnauthorized, sendValidationError } from "../lib/http.ts";

const SeedEntrySchema = z
  .object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mealType: MealTypeSchema,
    name: z.string().trim().min(1).max(200),
    calories: z.number().finite().nonnegative(),
    protein: z.number().finite().nonnegative(),
    carbs: z.number().finite().nonnegative(),
    fats: z.number().finite().nonnegative(),
    fiber: z.number().finite().nonnegative(),
    portion: z.string().trim().min(1).max(100).optional(),
    mealSlug: z.string().trim().min(1).max(60).nullable().optional(),
  })
  .strict();

const SeedProfileSchema = z
  .object({
    dailyCalorieGoal: z.number().finite().positive().max(20_000).optional(),
    weightKg: z.number().finite().positive().max(1_000).optional(),
    heightCm: z.number().finite().positive().max(500).optional(),
    preferredLanguage: PreferredLanguageSchema.optional(),
    nutritionGoal: NutritionGoalSchema.optional(),
  })
  .strict();

const MAX_SEED_ENTRIES_PER_USER = 2_000;

const ResetAndSeedSchema = z
  .object({
    users: z
      .array(
        z
          .object({
            email: z.string().email(),
            password: z.string().min(8).max(200),
            profile: SeedProfileSchema.optional(),
            entries: z.array(SeedEntrySchema).max(MAX_SEED_ENTRIES_PER_USER).optional(),
          })
          .strict(),
      )
      .max(20),
  })
  .strict()
  .refine(
    ({ users }) => new Set(users.map((user) => user.email.toLocaleLowerCase())).size === users.length,
    { message: "Seed user emails must be unique" },
  );

const AiModeSchema = z
  .object({
    parseFood: z
      .enum([
        "success",
        "multi-food",
        "explicit-nutrition",
        "explicit-meal",
        "delay",
        "ambiguous",
        "failure",
      ])
      .optional(),
    correction: z.enum(["success", "delay", "ambiguous", "failure"]).optional(),
    delayMs: z.number().int().min(0).max(10_000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one AI mode setting is required",
  });

const FailuresSchema = z
  .object({
    nextBatchSave: z.boolean(),
  })
  .strict();

const DelaysSchema = z
  .object({
    nextHistoricalSuggestionsMs: z.number().int().min(0).max(10_000),
  })
  .strict();

function secretFromRequest(request: FastifyRequest): string | undefined {
  const value = request.headers["x-e2e-control-secret"];
  return Array.isArray(value) ? value[0] : value;
}

function authorize(
  runtime: E2EControlRuntime,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply | undefined {
  if (!runtime.isAuthorized(secretFromRequest(request))) {
    return sendUnauthorized(reply);
  }
  return undefined;
}

export async function registerE2EControlRoutes(
  app: FastifyInstance,
  runtime: E2EControlRuntime,
): Promise<void> {
  assertE2EControlRuntime(runtime);

  app.post("/__e2e/reset", async (request, reply) => {
    const unauthorized = authorize(runtime, request, reply);
    if (unauthorized) return unauthorized;

    const parsed = ResetAndSeedSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply);
    return reply.status(200).send(await runtime.resetAndSeed(parsed.data));
  });

  app.post("/__e2e/ai-mode", async (request, reply) => {
    const unauthorized = authorize(runtime, request, reply);
    if (unauthorized) return unauthorized;

    const parsed = AiModeSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply);
    return reply.status(200).send(runtime.configureAi(parsed.data));
  });

  app.post("/__e2e/failures", async (request, reply) => {
    const unauthorized = authorize(runtime, request, reply);
    if (unauthorized) return unauthorized;

    const parsed = FailuresSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply);
    return reply
      .status(200)
      .send(runtime.configureNextBatchSaveFailure(parsed.data.nextBatchSave));
  });

  app.post("/__e2e/delays", async (request, reply) => {
    const unauthorized = authorize(runtime, request, reply);
    if (unauthorized) return unauthorized;

    const parsed = DelaysSchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply);
    return reply
      .status(200)
      .send(
        runtime.configureNextHistoricalSuggestionDelay(
          parsed.data.nextHistoricalSuggestionsMs,
        ),
      );
  });
}
