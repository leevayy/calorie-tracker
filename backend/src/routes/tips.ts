import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { DailyTipRequestSchema, DailyTipResponseSchema } from "../contracts/daily-tip.ts";
import { db } from "../db/client.ts";
import { foodEntriesTable, usersTable } from "../db/schema.ts";
import { addDays } from "../lib/dates.ts";
import { ErrorResponseJsonSchema, sendUnauthorized, sendValidationError } from "../lib/http.ts";
import { toJsonSchema } from "../lib/zod-schema.ts";
import { env } from "../env.ts";
import { AiModelPreferenceSchema, NutritionGoalSchema } from "../contracts/common.ts";
import {
  buildEnglishFallbackTipMessage,
  localizeTipWithAi,
  generateTipMessageWithAi,
  type RecentLog,
} from "../services/ai.ts";
function coerceNutritionGoal(raw: string) {
  const parsed = NutritionGoalSchema.safeParse(raw);
  return parsed.success ? parsed.data : "maintain";
}

function coerceAiModelPreference(raw: string) {
  const parsed = AiModelPreferenceSchema.safeParse(raw);
  return parsed.success ? parsed.data : "qwen3";
}

function coerceMealType(raw: string): RecentLog["mealType"] | undefined {
  switch (raw) {
    case "breakfast":
    case "lunch":
    case "dinner":
    case "snack":
      return raw;
    default:
      return undefined;
  }
}

function userIdFromRequest(request: FastifyRequest): string | null {
  const payload = request.user as { sub?: string } | undefined;
  return payload?.sub ?? null;
}

export async function registerTipsRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/tips/daily",
    {
      schema: {
        tags: ["tips"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema(DailyTipRequestSchema),
        response: {
          200: toJsonSchema(DailyTipResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const parsed = DailyTipRequestSchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply);

      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, userId),
      });
      if (!user) return sendUnauthorized(reply);

      const todayAggregateRows = await db
        .select({
          calories: sql<number>`coalesce(sum(${foodEntriesTable.calories}), 0)`.as("calories"),
          protein: sql<number>`coalesce(sum(${foodEntriesTable.protein}), 0)`.as("protein"),
          carbs: sql<number>`coalesce(sum(${foodEntriesTable.carbs}), 0)`.as("carbs"),
          fats: sql<number>`coalesce(sum(${foodEntriesTable.fats}), 0)`.as("fats"),
        })
        .from(foodEntriesTable)
        .where(and(eq(foodEntriesTable.userId, userId), eq(foodEntriesTable.day, parsed.data.date)));

      const todayAggregate = todayAggregateRows[0] ?? {
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
      };

      const historyRows = await db
        .select({
          day: foodEntriesTable.day,
          calories: sql<number>`coalesce(sum(${foodEntriesTable.calories}), 0)`.as("calories"),
        })
        .from(foodEntriesTable)
        .where(
          and(
            eq(foodEntriesTable.userId, userId),
            gte(foodEntriesTable.day, addDays(parsed.data.date, -6)),
            lt(foodEntriesTable.day, addDays(parsed.data.date, 1)),
          ),
        )
        .groupBy(foodEntriesTable.day);

      const weeklyAverageCalories =
        historyRows.length > 0
          ? Math.round(historyRows.reduce((sum, row) => sum + Number(row.calories), 0) / historyRows.length)
          : null;

      const goalBandSize = 250;
      const lowerBand = Math.floor(user.dailyCalorieGoal / goalBandSize) * goalBandSize;
      const upperBand = lowerBand + goalBandSize;

      const communityDaily = db
        .select({
          userId: foodEntriesTable.userId,
          calories: sql<number>`coalesce(sum(${foodEntriesTable.calories}), 0)`.as("calories"),
          protein: sql<number>`coalesce(sum(${foodEntriesTable.protein}), 0)`.as("protein"),
        })
        .from(foodEntriesTable)
        .where(eq(foodEntriesTable.day, parsed.data.date))
        .groupBy(foodEntriesTable.userId)
        .as("community_daily");

      const communityRows = await db
        .select({
          sampleSize: sql<number>`count(*)`.as("sample_size"),
          avgCalories: sql<number>`coalesce(avg(${communityDaily.calories}), 0)`.as("avg_calories"),
          avgProtein: sql<number>`coalesce(avg(${communityDaily.protein}), 0)`.as("avg_protein"),
        })
        .from(communityDaily)
        .innerJoin(usersTable, eq(usersTable.id, communityDaily.userId))
        .where(and(gte(usersTable.dailyCalorieGoal, lowerBand), lt(usersTable.dailyCalorieGoal, upperBand)));

      const community = communityRows[0];
      const hasCommunityStats = (community?.sampleSize ?? 0) >= env.DAILY_TIP_K_ANONYMITY_MIN;

      const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const recentEntryRows = await db
        .select({
          createdAt: foodEntriesTable.createdAt,
          name: foodEntriesTable.name,
          mealSlug: foodEntriesTable.mealSlug,
          calories: foodEntriesTable.calories,
          protein: foodEntriesTable.protein,
          carbs: foodEntriesTable.carbs,
          fats: foodEntriesTable.fats,
          mealType: foodEntriesTable.mealType,
        })
        .from(foodEntriesTable)
        .where(and(eq(foodEntriesTable.userId, userId), gte(foodEntriesTable.createdAt, seventyTwoHoursAgo)))
        .orderBy(desc(foodEntriesTable.createdAt))
        .limit(10);

      const recentLogs: RecentLog[] = [...recentEntryRows].reverse().map((row) => ({
        timestamp: row.createdAt.toISOString(),
        name: row.name,
        mealSlug: row.mealSlug ?? null,
        calories: Number(row.calories ?? 0),
        proteinG: Number(row.protein ?? 0),
        carbsG: Number(row.carbs ?? 0),
        fatsG: Number(row.fats ?? 0),
        mealType: coerceMealType(row.mealType),
      }));

      const context = {
        date: parsed.data.date,
        consumedCalories: Number(todayAggregate.calories ?? 0),
        calorieGoal: user.dailyCalorieGoal,
        proteinG: Number(todayAggregate.protein ?? 0),
        carbsG: Number(todayAggregate.carbs ?? 0),
        fatsG: Number(todayAggregate.fats ?? 0),
        weeklyAverageCalories,
        communityAvgCalories: hasCommunityStats ? Number(community?.avgCalories ?? 0) : null,
        clientTimeZone: parsed.data.clientTimeZone,
        localTimeHm: parsed.data.localTimeHm,
        preferredLanguage: parsed.data.preferredLanguage,
        nutritionGoal: coerceNutritionGoal(user.nutritionGoal),
        tipVibePrompt: user.tipVibePrompt ?? "",
        recentLogs,
      };

      let message = "";
      const aiPref = coerceAiModelPreference(user.aiModelPreference);
      if (env.YANDEX_AI_STUDIO_API_KEY) {
        try {
          message = await generateTipMessageWithAi(context, aiPref);
        } catch {
          message = await localizeTipWithAi(
            buildEnglishFallbackTipMessage(context),
            context.preferredLanguage,
            aiPref,
          );
        }
      } else {
        message = buildEnglishFallbackTipMessage(context);
      }

      const response = DailyTipResponseSchema.parse({
        message,
        generatedAt: new Date().toISOString(),
        sourcesUsed: hasCommunityStats
          ? ["user_today", "user_profile", "user_history", "community_aggregate"]
          : ["user_today", "user_profile", "user_history"],
        communitySnapshot: hasCommunityStats
          ? {
              cohortLabel: `${lowerBand}-${upperBand - 1} kcal goal`,
              sampleSize: Number(community?.sampleSize ?? 0),
              avgCaloriesAtSameUtcOffset: Number(community?.avgCalories ?? 0),
              avgProteinGAtSameUtcOffset: Number(community?.avgProtein ?? 0),
            }
          : undefined,
      });

      return reply.status(200).send(response);
    },
  );
}
