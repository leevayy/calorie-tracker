import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  CorrectFoodEntryRequestSchema,
  CorrectFoodEntryResponseSchema,
} from "../contracts/ai-food.ts";
import { UpdateFoodEntryBodySchema } from "../contracts/food-log.ts";
import { ErrorResponseJsonSchema, sendUnauthorized, sendValidationError } from "../lib/http.ts";
import { toJsonSchema } from "../lib/zod-schema.ts";
import {
  FoodEntryCorrectionRejectedError,
  proposeFoodEntryCorrection,
  type FoodEntryCorrectionClassifier,
} from "../services/foodEntryCorrection.ts";
import { classifyFoodEntryCorrectionWithAi } from "../services/foodEntryCorrectionAi.ts";
import {
  drizzleFoodLogRepository,
  type FoodEntryRecord,
  type FoodLogRepository,
} from "../services/foodLogRepository.ts";

const EntryParamSchema = z.object({
  entryId: z.string().uuid(),
});

type FoodEntryCorrectionRepository = Pick<FoodLogRepository, "findActiveEntry">;

export type FoodEntryCorrectionRouteDependencies = {
  repository: FoodEntryCorrectionRepository;
  classify: FoodEntryCorrectionClassifier;
};

const defaultDependencies: FoodEntryCorrectionRouteDependencies = {
  repository: drizzleFoodLogRepository,
  classify: classifyFoodEntryCorrectionWithAi,
};

function userIdFromRequest(request: FastifyRequest): string | null {
  const payload = request.user as { sub?: string } | undefined;
  return payload?.sub ?? null;
}

function correctionContextFromRecord(entry: FoodEntryRecord) {
  return UpdateFoodEntryBodySchema.parse({
    name: entry.name,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fats: entry.fats,
    fiber: entry.fiber,
    portion: entry.portion ?? undefined,
    day: entry.day,
    mealType: entry.mealType,
  });
}

export async function registerFoodEntryCorrectionRoutes(
  app: FastifyInstance,
  overrides: Partial<FoodEntryCorrectionRouteDependencies> = {},
): Promise<void> {
  const dependencies = { ...defaultDependencies, ...overrides };

  app.post(
    "/ai/entries/:entryId/correction",
    {
      schema: {
        tags: ["ai", "food-log"],
        security: [{ bearerAuth: [] }],
        params: toJsonSchema(EntryParamSchema),
        body: toJsonSchema(CorrectFoodEntryRequestSchema),
        response: {
          200: toJsonSchema(CorrectFoodEntryResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
          404: ErrorResponseJsonSchema,
          422: ErrorResponseJsonSchema,
          502: ErrorResponseJsonSchema,
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const params = EntryParamSchema.safeParse(request.params);
      if (!params.success) return sendValidationError(reply);
      const body = CorrectFoodEntryRequestSchema.safeParse(request.body);
      if (!body.success) return sendValidationError(reply);

      const current = await dependencies.repository.findActiveEntry(userId, params.data.entryId);
      if (!current) return reply.status(404).send({ message: "Entry not found" });

      try {
        const response = await proposeFoodEntryCorrection(
          correctionContextFromRecord(current),
          body.data,
          dependencies.classify,
        );
        return reply.status(200).send(response);
      } catch (error) {
        if (error instanceof FoodEntryCorrectionRejectedError) {
          return reply.status(422).send({ message: "Correction instruction was not actionable" });
        }
        return reply.status(502).send({ message: "AI provider error" });
      }
    },
  );
}
