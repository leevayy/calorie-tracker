import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  AiModelPreferenceSchema,
  NutritionGoalSchema,
  PreferredLanguageSchema,
} from "../contracts/common.ts";
import {
  SetTipVibeRequestSchema,
  UpdateProfileRequestSchema,
  UserProfileResponseSchema,
} from "../contracts/profile.ts";
import { db } from "../db/client.ts";
import { usersTable } from "../db/schema.ts";
import { env } from "../env.ts";
import { ErrorResponseJsonSchema, sendUnauthorized, sendValidationError } from "../lib/http.ts";
import { toJsonSchema } from "../lib/zod-schema.ts";
import { pickEmojiForVibePromptWithAi } from "../services/ai.ts";
import { DEFAULT_TIP_VIBE_PROMPTS } from "../services/tips/vibePrompts.ts";

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
  return parsed.success ? parsed.data : "qwen3";
}

const PRESET_VIBE_EMOJI: Record<"toxic" | "gymBro" | "caveman", string> = {
  toxic: "😡",
  gymBro: "💪",
  caveman: "🗿",
};

type UserRow = typeof usersTable.$inferSelect;

function buildProfileResponse(user: UserRow) {
  return UserProfileResponseSchema.parse({
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
    tipVibePrompt: user.tipVibePrompt ?? "",
    tipVibeEmoji: user.tipVibeEmoji ?? null,
    updatedAt: user.updatedAt.toISOString(),
  });
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

      return reply.status(200).send(buildProfileResponse(user));
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
          tipVibePrompt: parsed.data.clearTipVibe ? "" : current.tipVibePrompt,
          tipVibeEmoji: parsed.data.clearTipVibe ? null : current.tipVibeEmoji,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId));

      const updated = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, userId),
      });
      if (!updated) return sendUnauthorized(reply);

      return reply.status(200).send(buildProfileResponse(updated));
    },
  );

  app.put(
    "/me/tip-vibe",
    {
      schema: {
        tags: ["profile"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema(SetTipVibeRequestSchema),
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

      const parsed = SetTipVibeRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply);

      const current = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, userId),
      });
      if (!current) return sendUnauthorized(reply);

      const trimmedPrompt = parsed.data.prompt.trim();

      let nextPrompt = "";
      let nextEmoji: string | null = null;

      if (trimmedPrompt.length > 0) {
        if (parsed.data.slot === "custom") {
          nextPrompt = trimmedPrompt;
          // Server picks the emoji for custom prompts; falls back gracefully when AI is unavailable.
          if (env.YANDEX_AI_STUDIO_API_KEY) {
            nextEmoji = await pickEmojiForVibePromptWithAi(
              trimmedPrompt,
              coerceAiModelPreference(current.aiModelPreference),
            );
          } else {
            nextEmoji = "✨";
          }
        } else {
          nextPrompt = trimmedPrompt;
          nextEmoji = PRESET_VIBE_EMOJI[parsed.data.slot];
          // Sanity: if the user just submits the canonical default unchanged, that's still fine to store.
          // We deliberately persist the (possibly edited) text so the AI uses the user's exact wording.
          if (!nextPrompt) {
            nextPrompt = DEFAULT_TIP_VIBE_PROMPTS[parsed.data.slot];
          }
        }
      }

      await db
        .update(usersTable)
        .set({
          tipVibePrompt: nextPrompt,
          tipVibeEmoji: nextEmoji,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId));

      const updated = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, userId),
      });
      if (!updated) return sendUnauthorized(reply);

      return reply.status(200).send(buildProfileResponse(updated));
    },
  );
}
