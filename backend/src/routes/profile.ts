import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  AiModelPreferenceSchema,
  NutritionGoalSchema,
  PreferredLanguageSchema,
} from "../contracts/common.ts";
import {
  UpdateProfileRequestSchema,
  UserProfileResponseSchema,
} from "../contracts/profile.ts";
import { db } from "../db/client.ts";
import { usersTable } from "../db/schema.ts";
import { ErrorResponseJsonSchema, sendUnauthorized, sendValidationError } from "../lib/http.ts";
import { toJsonSchema } from "../lib/zod-schema.ts";

function userIdFromRequest(request: FastifyRequest): string | null {
  const payload = request.user as { sub?: string } | undefined;
  return payload?.sub ?? null;
}

function coercePreferredLanguage(raw: string) {
  const parsed = PreferredLanguageSchema.safeParse(raw);
  return parsed.success ? parsed.data : "en";
}

function coerceNutritionGoal(raw: string) {
  const parsed = NutritionGoalSchema.safeParse(raw);
  return parsed.success ? parsed.data : "maintain";
}

function coerceAiModelPreference(raw: string) {
  const parsed = AiModelPreferenceSchema.safeParse(raw);
  return parsed.success ? parsed.data : "deepseek";
}

export async function registerProfileRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/me",
    {
      schema: {
        tags: ["profile"],
        security: [{ bearerAuth: [] }],
        response: {
          200: toJsonSchema(UserProfileResponseSchema),
          401: ErrorResponseJsonSchema,
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, userId),
      });
      if (!user) return sendUnauthorized(reply);

      const response = UserProfileResponseSchema.parse({
        user: {
          id: user.id,
          email: user.email,
        },
        dailyCalorieGoal: user.dailyCalorieGoal,
        weightKg: user.weightKg ?? undefined,
        heightCm: user.heightCm ?? undefined,
        preferredLanguage: coercePreferredLanguage(user.preferredLanguage),
        nutritionGoal: coerceNutritionGoal(user.nutritionGoal),
        aiModelPreference: coerceAiModelPreference(user.aiModelPreference),
        updatedAt: user.updatedAt.toISOString(),
      });

      return reply.status(200).send(response);
    },
  );

  app.patch(
    "/me",
    {
      schema: {
        tags: ["profile"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema(UpdateProfileRequestSchema),
        response: {
          200: toJsonSchema(UserProfileResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const parsed = UpdateProfileRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply);

      const current = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, userId),
      });
      if (!current) return sendUnauthorized(reply);

      await db
        .update(usersTable)
        .set({
          dailyCalorieGoal: parsed.data.dailyCalorieGoal ?? current.dailyCalorieGoal,
          weightKg: parsed.data.weightKg ?? current.weightKg,
          heightCm: parsed.data.heightCm ?? current.heightCm,
          preferredLanguage: parsed.data.preferredLanguage ?? current.preferredLanguage,
          nutritionGoal: parsed.data.nutritionGoal ?? current.nutritionGoal,
          aiModelPreference: parsed.data.aiModelPreference ?? current.aiModelPreference,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId));

      const updated = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, userId),
      });
      if (!updated) return sendUnauthorized(reply);

      const response = UserProfileResponseSchema.parse({
        user: {
          id: updated.id,
          email: updated.email,
        },
        dailyCalorieGoal: updated.dailyCalorieGoal,
        weightKg: updated.weightKg ?? undefined,
        heightCm: updated.heightCm ?? undefined,
        preferredLanguage: coercePreferredLanguage(updated.preferredLanguage),
        nutritionGoal: coerceNutritionGoal(updated.nutritionGoal),
        aiModelPreference: coerceAiModelPreference(updated.aiModelPreference),
        updatedAt: updated.updatedAt.toISOString(),
      });

      return reply.status(200).send(response);
    },
  );
}
