import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { HistoryQuerySchema, HistoryRangeResponseSchema } from "../contracts/history.ts";
import { db } from "../db/client.ts";
import { foodEntriesTable, usersTable } from "../db/schema.ts";
import { enumerateDates } from "../lib/dates.ts";
import { ErrorResponseJsonSchema, sendUnauthorized, sendValidationError } from "../lib/http.ts";
import { toJsonSchema } from "../lib/zod-schema.ts";

function userIdFromRequest(request: FastifyRequest): string | null {
  const payload = request.user as { sub?: string } | undefined;
  return payload?.sub ?? null;
}

export async function registerHistoryRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/history",
    {
      schema: {
        tags: ["history"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema(HistoryQuerySchema),
        response: {
          200: toJsonSchema(HistoryRangeResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const parsed = HistoryQuerySchema.safeParse(request.query);
      if (!parsed.success) return sendValidationError(reply);
      if (parsed.data.from > parsed.data.to) {
        return sendValidationError(reply, "from must be less than or equal to to");
      }

      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, userId),
      });
      if (!user) return sendUnauthorized(reply);

      const daysInRange = enumerateDates(parsed.data.from, parsed.data.to);
      const aggregateRows = await db
        .select({
          day: foodEntriesTable.day,
          calories: sql<number>`coalesce(sum(${foodEntriesTable.calories}), 0)`.as("calories"),
          protein: sql<number>`coalesce(sum(${foodEntriesTable.protein}), 0)`.as("protein"),
          carbs: sql<number>`coalesce(sum(${foodEntriesTable.carbs}), 0)`.as("carbs"),
          fats: sql<number>`coalesce(sum(${foodEntriesTable.fats}), 0)`.as("fats"),
        })
        .from(foodEntriesTable)
        .where(
          and(
            eq(foodEntriesTable.userId, userId),
            gte(foodEntriesTable.day, parsed.data.from),
            lte(foodEntriesTable.day, parsed.data.to),
          ),
        )
        .groupBy(foodEntriesTable.day);

      const rowByDay = new Map(
        aggregateRows.map((row) => [
          row.day,
          {
            calories: Number(row.calories),
            protein: Number(row.protein),
            carbs: Number(row.carbs),
            fats: Number(row.fats),
          },
        ]),
      );

      const points = daysInRange.map((date) => {
        const row = rowByDay.get(date);
        return {
          date,
          calories: row?.calories ?? 0,
          goal: user.dailyCalorieGoal,
          protein: row?.protein ?? 0,
          carbs: row?.carbs ?? 0,
          fats: row?.fats ?? 0,
        };
      });

      const today = parsed.data.today;
      const pointsForAverage = points.filter(
        (p) => p.calories > 0 && (today === undefined || p.date !== today),
      );
      const weeklyAverageCalories =
        pointsForAverage.length > 0
          ? Math.round(
              pointsForAverage.reduce((sum, point) => sum + point.calories, 0) /
                pointsForAverage.length,
            )
          : 0;

      const response = HistoryRangeResponseSchema.parse({
        from: parsed.data.from,
        to: parsed.data.to,
        days: points,
        weeklyAverageCalories,
      });

      reply.header("Cache-Control", "no-store, private");
      return reply.status(200).send(response);
    },
  );
}
