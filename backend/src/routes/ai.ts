import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { AiModelPreferenceSchema, NutritionGoalSchema } from "../contracts/common.ts";
import { ParseFoodRequestSchema, ParseFoodResponseSchema } from "../contracts/ai-food.ts";
import { db } from "../db/client.ts";
import { usersTable } from "../db/schema.ts";
import { ErrorResponseJsonSchema, sendUnauthorized, sendValidationError } from "../lib/http.ts";
import { toJsonSchema } from "../lib/zod-schema.ts";
import { parseFoodTextWithAi } from "../services/ai.ts";

function coerceNutritionGoal(raw: string) {
  const parsed = NutritionGoalSchema.safeParse(raw);
  return parsed.success ? parsed.data : "maintain";
}

function coerceAiModelPreference(raw: string) {
  const parsed = AiModelPreferenceSchema.safeParse(raw);
  return parsed.success ? parsed.data : "qwen3";
}

function userIdFromRequest(request: FastifyRequest): string | null {
  const payload = request.user as { sub?: string } | undefined;
  return payload?.sub ?? null;
}

export async function registerAiRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/ai/parse-food",
    {
      schema: {
        tags: ["ai"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema(ParseFoodRequestSchema),
        response: {
          200: toJsonSchema(ParseFoodResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
          502: ErrorResponseJsonSchema,
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const parsed = ParseFoodRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply);

      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, userId),
      });
      if (!user) return sendUnauthorized(reply);

      try {
        const suggestions = await parseFoodTextWithAi(
          parsed.data.text,
          parsed.data.preferredLanguage,
          coerceNutritionGoal(user.nutritionGoal),
          coerceAiModelPreference(user.aiModelPreference),
        );
        const response = ParseFoodResponseSchema.parse({ suggestions });
        return reply.status(200).send(response);
      } catch {
        return reply.status(502).send({ message: "AI provider error" });
      }
    },
  );
}
