import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { CreateFoodEntryBodySchema, DayLogResponseSchema, FoodEntryResponseSchema } from "../contracts/food-log.ts";
import { IsoDateSchema } from "../contracts/common.ts";
import { db } from "../db/client.ts";
import { foodEntriesTable, usersTable } from "../db/schema.ts";
import { ErrorResponseJsonSchema, sendUnauthorized, sendValidationError } from "../lib/http.ts";
import { toJsonSchema } from "../lib/zod-schema.ts";

const DayParamSchema = z.object({
  day: IsoDateSchema,
});

const EntryParamSchema = z.object({
  entryId: z.string().uuid(),
});

function userIdFromRequest(request: FastifyRequest): string | null {
  const payload = request.user as { sub?: string } | undefined;
  return payload?.sub ?? null;
}

export async function registerFoodLogRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/days/:day",
    {
      schema: {
        tags: ["food-log"],
        security: [{ bearerAuth: [] }],
        params: toJsonSchema(DayParamSchema),
        response: {
          200: toJsonSchema(DayLogResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const dayParsed = DayParamSchema.safeParse(request.params);
      if (!dayParsed.success) return sendValidationError(reply);

      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, userId),
      });
      if (!user) return sendUnauthorized(reply);

      const entries = await db.query.foodEntriesTable.findMany({
        where: and(eq(foodEntriesTable.userId, userId), eq(foodEntriesTable.day, dayParsed.data.day)),
        orderBy: (table, { asc }) => [asc(table.createdAt)],
      });

      const meals: {
        breakfast: Array<z.infer<typeof FoodEntryResponseSchema>>;
        lunch: Array<z.infer<typeof FoodEntryResponseSchema>>;
        dinner: Array<z.infer<typeof FoodEntryResponseSchema>>;
        snack?: Array<z.infer<typeof FoodEntryResponseSchema>>;
      } = {
        breakfast: [],
        lunch: [],
        dinner: [],
      };

      for (const row of entries) {
        const item = FoodEntryResponseSchema.parse({
          id: row.id,
          mealType: row.mealType,
          day: row.day,
          name: row.name,
          calories: row.calories,
          protein: row.protein,
          carbs: row.carbs,
          fats: row.fats,
          portion: row.portion ?? undefined,
          createdAt: row.createdAt.toISOString(),
        });
        if (row.mealType === "snack") {
          if (!meals.snack) meals.snack = [];
          meals.snack.push(item);
        } else if (row.mealType === "breakfast") {
          meals.breakfast.push(item);
        } else if (row.mealType === "lunch") {
          meals.lunch.push(item);
        } else if (row.mealType === "dinner") {
          meals.dinner.push(item);
        } else {
          continue;
        }
      }

      const totalCalories = entries.reduce((sum, row) => sum + row.calories, 0);
      const response = DayLogResponseSchema.parse({
        day: dayParsed.data.day,
        calorieGoal: user.dailyCalorieGoal,
        totalCalories,
        meals,
      });
      return reply.status(200).send(response);
    },
  );

  app.post(
    "/days/:day/entries",
    {
      schema: {
        tags: ["food-log"],
        security: [{ bearerAuth: [] }],
        params: toJsonSchema(DayParamSchema),
        body: toJsonSchema(CreateFoodEntryBodySchema),
        response: {
          201: toJsonSchema(FoodEntryResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const dayParsed = DayParamSchema.safeParse(request.params);
      if (!dayParsed.success) return sendValidationError(reply);

      const bodyParsed = CreateFoodEntryBodySchema.safeParse(request.body);
      if (!bodyParsed.success) return sendValidationError(reply);

      const createdAt = new Date();
      const entry = {
        id: randomUUID(),
        userId,
        day: dayParsed.data.day,
        mealType: bodyParsed.data.mealType,
        name: bodyParsed.data.name,
        calories: bodyParsed.data.calories,
        protein: bodyParsed.data.protein,
        carbs: bodyParsed.data.carbs,
        fats: bodyParsed.data.fats,
        portion: bodyParsed.data.portion ?? null,
        createdAt,
      };

      await db.insert(foodEntriesTable).values(entry);

      const response = FoodEntryResponseSchema.parse({
        id: entry.id,
        mealType: entry.mealType,
        day: entry.day,
        name: entry.name,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fats: entry.fats,
        portion: entry.portion ?? undefined,
        createdAt: createdAt.toISOString(),
      });

      return reply.status(201).send(response);
    },
  );

  app.delete(
    "/entries/:entryId",
    {
      schema: {
        tags: ["food-log"],
        security: [{ bearerAuth: [] }],
        params: toJsonSchema(EntryParamSchema),
        response: {
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
          404: ErrorResponseJsonSchema,
          204: {
            type: "null",
          },
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const parsed = EntryParamSchema.safeParse(request.params);
      if (!parsed.success) return sendValidationError(reply);

      const result = await db
        .delete(foodEntriesTable)
        .where(and(eq(foodEntriesTable.id, parsed.data.entryId), eq(foodEntriesTable.userId, userId)))
        .returning({ id: foodEntriesTable.id });

      if (result.length === 0) {
        return reply.status(404).send({ message: "Entry not found" });
      }

      return reply.status(204).send();
    },
  );
}
