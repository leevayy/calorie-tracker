import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { NutritionGoalSchema } from "../contracts/common.ts";
import { ParseFoodRequestSchema, ParseFoodResponseSchema } from "../contracts/ai-food.ts";
import { db } from "../db/client.ts";
import { usersTable } from "../db/schema.ts";
import { env } from "../env.ts";
import { ErrorResponseJsonSchema, sendUnauthorized, sendValidationError } from "../lib/http.ts";
import { toJsonSchema } from "../lib/zod-schema.ts";
import { parseFoodTextWithAi } from "../services/ai.ts";

export type AiRouteDependencies = {
  parseFood: typeof parseFoodTextWithAi;
};

const defaultDependencies: AiRouteDependencies = {
  parseFood: parseFoodTextWithAi,
};

function coerceNutritionGoal(raw: string) {
  const parsed = NutritionGoalSchema.safeParse(raw);
  return parsed.success ? parsed.data : "maintain";
}

function userIdFromRequest(request: FastifyRequest): string | null {
  const payload = request.user as { sub?: string } | undefined;
  return payload?.sub ?? null;
}

export async function registerAiRoutes(
  app: FastifyInstance,
  overrides: Partial<AiRouteDependencies> = {},
): Promise<void> {
  const dependencies = { ...defaultDependencies, ...overrides };

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
        const suggestions = await dependencies.parseFood(
          parsed.data.text,
          parsed.data.preferredLanguage,
          coerceNutritionGoal(user.nutritionGoal),
          env.AI_MODEL_PREFERENCE,
          {
            localDate: parsed.data.localDate,
            localTimeHm: parsed.data.localTimeHm,
            clientTimeZone: parsed.data.clientTimeZone,
            defaultLogDay: parsed.data.defaultLogDay,
            defaultMealType: parsed.data.defaultMealType,
          },
        );
        const response = ParseFoodResponseSchema.parse({ suggestions });
        return reply.status(200).send(response);
      } catch {
        return reply.status(502).send({ message: "AI provider error" });
      }
    },
  );
}
