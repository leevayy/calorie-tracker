import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  CreateFoodEntriesBodySchema,
  CreateFoodEntriesResponseSchema,
  CreateFoodEntryBodySchema,
  DayLogResponseSchema,
  DeleteFoodEntriesBodySchema,
  DeleteFoodEntriesResponseSchema,
  FoodEntryResponseSchema,
  FrequentFoodsQuerySchema,
  FrequentFoodsResponseSchema,
  HistoricalFoodSuggestionsQuerySchema,
  HistoricalFoodSuggestionsResponseSchema,
  UpdateFoodEntryBodySchema,
  type CreateFoodEntryRequest,
  type FoodEntryResponse,
} from "../contracts/food-log.ts";
import {
  AiModelPreferenceSchema,
  IsoDateSchema,
  type AiModelPreference,
} from "../contracts/common.ts";
import { ErrorResponseJsonSchema, sendUnauthorized, sendValidationError } from "../lib/http.ts";
import { toJsonSchema } from "../lib/zod-schema.ts";
import {
  drizzleFoodLogRepository,
  type FoodEntryRecord,
  type FoodEntryUpdate,
  type FoodLogRepository,
  type FoodLogUserRecord,
} from "../services/foodLogRepository.ts";
import { resolveMealSlugFromLoggedName } from "../services/mealSlug.ts";
import { sanitizeMealSlug } from "../services/slugShape.ts";

export type {
  FoodEntryRecord,
  FoodEntryUpdate,
  FoodLogRepository,
  FoodLogUserRecord,
} from "../services/foodLogRepository.ts";

function coerceAiModelPreference(raw: string): AiModelPreference {
  const parsed = AiModelPreferenceSchema.safeParse(raw);
  return parsed.success ? parsed.data : "qwen3";
}

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

function toFoodEntryResponse(row: FoodEntryRecord): FoodEntryResponse {
  return FoodEntryResponseSchema.parse({
    id: row.id,
    mealType: row.mealType,
    day: row.day,
    name: row.name,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fats: row.fats,
    fiber: row.fiber,
    portion: row.portion ?? undefined,
    mealSlug: row.mealSlug ?? undefined,
    createdAt: row.createdAt.toISOString(),
  });
}

type ResolveMealSlug = (
  name: string,
  context: { aiModelPreference: AiModelPreference },
) => Promise<string>;

export type FoodLogRouteDependencies = {
  repository: FoodLogRepository;
  resolveMealSlug: ResolveMealSlug;
  createId: () => string;
  now: () => Date;
};

const defaultDependencies: FoodLogRouteDependencies = {
  repository: drizzleFoodLogRepository,
  resolveMealSlug: resolveMealSlugFromLoggedName,
  createId: randomUUID,
  now: () => new Date(),
};

async function resolveSlug(
  entry: Pick<CreateFoodEntryRequest, "name" | "mealSlug">,
  user: FoodLogUserRecord,
  resolver: ResolveMealSlug,
): Promise<string> {
  const clientSlug = entry.mealSlug ? sanitizeMealSlug(entry.mealSlug) : null;
  return (
    clientSlug ??
    resolver(entry.name, {
      aiModelPreference: coerceAiModelPreference(user.aiModelPreference),
    })
  );
}

function createRecord(
  input: CreateFoodEntryRequest,
  userId: string,
  mealSlug: string,
  dependencies: FoodLogRouteDependencies,
): FoodEntryRecord {
  return {
    id: dependencies.createId(),
    userId,
    day: input.day,
    mealType: input.mealType,
    name: input.name,
    calories: input.calories,
    protein: input.protein,
    carbs: input.carbs,
    fats: input.fats,
    fiber: input.fiber,
    portion: input.portion ?? null,
    mealSlug,
    createdAt: dependencies.now(),
    deletedAt: null,
  };
}

export async function registerFoodLogRoutes(
  app: FastifyInstance,
  overrides: Partial<FoodLogRouteDependencies> = {},
): Promise<void> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const { repository } = dependencies;

  app.get(
    "/food-suggestions",
    {
      schema: {
        tags: ["food-log"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema(HistoricalFoodSuggestionsQuerySchema),
        response: {
          200: toJsonSchema(HistoricalFoodSuggestionsResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const parsed = HistoricalFoodSuggestionsQuerySchema.safeParse(request.query);
      if (!parsed.success) return sendValidationError(reply);

      const user = await repository.findUser(userId);
      if (!user) return sendUnauthorized(reply);

      const items = await repository.findHistoricalFoodSuggestions(
        userId,
        parsed.data.query,
        parsed.data.limit,
      );
      return reply.status(200).send(HistoricalFoodSuggestionsResponseSchema.parse({
        items: items.map((item) => ({
          ...item,
          portion: item.portion ?? undefined,
          mealSlug: item.mealSlug ?? undefined,
        })),
      }));
    },
  );

  app.get(
    "/frequent-foods",
    {
      schema: {
        tags: ["food-log"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema(FrequentFoodsQuerySchema),
        response: {
          200: toJsonSchema(FrequentFoodsResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const parsed = FrequentFoodsQuerySchema.safeParse(request.query);
      if (!parsed.success) return sendValidationError(reply);
      if (parsed.data.from > parsed.data.to) {
        return sendValidationError(reply, "from must be less than or equal to to");
      }

      const user = await repository.findUser(userId);
      if (!user) return sendUnauthorized(reply);

      const rows = await repository.findFrequentFoods(
        userId,
        parsed.data.from,
        parsed.data.to,
        parsed.data.limit,
      );
      const response = FrequentFoodsResponseSchema.parse({ items: rows });
      return reply.status(200).send(response);
    },
  );

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

      const user = await repository.findUser(userId);
      if (!user) return sendUnauthorized(reply);

      const entries = await repository.findDayEntries(userId, dayParsed.data.day);
      const meals: {
        breakfast: FoodEntryResponse[];
        lunch: FoodEntryResponse[];
        dinner: FoodEntryResponse[];
        snack?: FoodEntryResponse[];
      } = {
        breakfast: [],
        lunch: [],
        dinner: [],
      };

      for (const row of entries) {
        const item = toFoodEntryResponse(row);
        if (row.mealType === "snack") {
          if (!meals.snack) meals.snack = [];
          meals.snack.push(item);
        } else if (row.mealType === "breakfast") {
          meals.breakfast.push(item);
        } else if (row.mealType === "lunch") {
          meals.lunch.push(item);
        } else if (row.mealType === "dinner") {
          meals.dinner.push(item);
        }
      }

      const response = DayLogResponseSchema.parse({
        day: dayParsed.data.day,
        calorieGoal: user.dailyCalorieGoal,
        totalCalories: entries.reduce((sum, row) => sum + row.calories, 0),
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

      const user = await repository.findUser(userId);
      if (!user) return sendUnauthorized(reply);

      const input: CreateFoodEntryRequest = { ...bodyParsed.data, day: dayParsed.data.day };
      const mealSlug = await resolveSlug(input, user, dependencies.resolveMealSlug);
      const record = createRecord(input, userId, mealSlug, dependencies);
      const [created] = await repository.createEntriesAtomic([record]);
      if (!created) throw new Error("Food entry insert returned no entry");
      return reply.status(201).send(toFoodEntryResponse(created));
    },
  );

  app.post(
    "/entries/batch",
    {
      schema: {
        tags: ["food-log"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema(CreateFoodEntriesBodySchema),
        response: {
          201: toJsonSchema(CreateFoodEntriesResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const bodyParsed = CreateFoodEntriesBodySchema.safeParse(request.body);
      if (!bodyParsed.success) return sendValidationError(reply);

      const user = await repository.findUser(userId);
      if (!user) return sendUnauthorized(reply);

      // Resolve every potentially remote slug before opening the explicit DB transaction.
      const mealSlugs = await Promise.all(
        bodyParsed.data.entries.map((entry) =>
          resolveSlug(entry, user, dependencies.resolveMealSlug),
        ),
      );
      const records = bodyParsed.data.entries.map((entry, index) =>
        createRecord(entry, userId, mealSlugs[index] ?? "unknown", dependencies),
      );
      const created = await repository.createEntriesAtomic(records);
      if (created.length !== records.length) {
        throw new Error("Food entry batch insert returned an incomplete group");
      }
      const response = CreateFoodEntriesResponseSchema.parse({
        entries: created.map(toFoodEntryResponse),
      });
      return reply.status(201).send(response);
    },
  );

  app.patch(
    "/entries/:entryId",
    {
      schema: {
        tags: ["food-log"],
        security: [{ bearerAuth: [] }],
        params: toJsonSchema(EntryParamSchema),
        body: toJsonSchema(UpdateFoodEntryBodySchema),
        response: {
          200: toJsonSchema(FoodEntryResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
          404: ErrorResponseJsonSchema,
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const paramsParsed = EntryParamSchema.safeParse(request.params);
      if (!paramsParsed.success) return sendValidationError(reply);
      const bodyParsed = UpdateFoodEntryBodySchema.safeParse(request.body);
      if (!bodyParsed.success) return sendValidationError(reply);

      const user = await repository.findUser(userId);
      if (!user) return sendUnauthorized(reply);
      const current = await repository.findActiveEntry(userId, paramsParsed.data.entryId);
      if (!current) return reply.status(404).send({ message: "Entry not found" });

      const mealSlug = await dependencies.resolveMealSlug(bodyParsed.data.name, {
        aiModelPreference: coerceAiModelPreference(user.aiModelPreference),
      });
      const changes: FoodEntryUpdate = {
        day: bodyParsed.data.day,
        mealType: bodyParsed.data.mealType,
        name: bodyParsed.data.name,
        calories: bodyParsed.data.calories,
        protein: bodyParsed.data.protein,
        carbs: bodyParsed.data.carbs,
        fats: bodyParsed.data.fats,
        fiber: bodyParsed.data.fiber,
        portion: bodyParsed.data.portion ?? null,
        mealSlug,
      };
      const updated = await repository.updateEntry(userId, paramsParsed.data.entryId, changes);
      if (!updated) return reply.status(404).send({ message: "Entry not found" });
      return reply.status(200).send(toFoodEntryResponse(updated));
    },
  );

  app.delete(
    "/entries/batch",
    {
      schema: {
        tags: ["food-log"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema(DeleteFoodEntriesBodySchema),
        response: {
          200: toJsonSchema(DeleteFoodEntriesResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
          404: ErrorResponseJsonSchema,
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const parsed = DeleteFoodEntriesBodySchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply);
      const deleted = await repository.softDeleteEntriesAtomic(
        userId,
        parsed.data.entryIds,
        dependencies.now(),
      );
      if (!deleted) return reply.status(404).send({ message: "Entry group not found" });
      const response = DeleteFoodEntriesResponseSchema.parse({
        entries: deleted.map(toFoodEntryResponse),
      });
      return reply.status(200).send(response);
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
          200: toJsonSchema(FoodEntryResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
          404: ErrorResponseJsonSchema,
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const parsed = EntryParamSchema.safeParse(request.params);
      if (!parsed.success) return sendValidationError(reply);

      const deleted = await repository.softDeleteEntry(
        userId,
        parsed.data.entryId,
        dependencies.now(),
      );
      if (!deleted) return reply.status(404).send({ message: "Entry not found" });
      return reply.status(200).send(toFoodEntryResponse(deleted));
    },
  );

  app.post(
    "/entries/:entryId/restore",
    {
      schema: {
        tags: ["food-log"],
        security: [{ bearerAuth: [] }],
        params: toJsonSchema(EntryParamSchema),
        response: {
          200: toJsonSchema(FoodEntryResponseSchema),
          400: ErrorResponseJsonSchema,
          401: ErrorResponseJsonSchema,
          404: ErrorResponseJsonSchema,
        },
      },
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const userId = userIdFromRequest(request);
      if (!userId) return sendUnauthorized(reply);

      const parsed = EntryParamSchema.safeParse(request.params);
      if (!parsed.success) return sendValidationError(reply);

      const restored = await repository.restoreEntry(userId, parsed.data.entryId);
      if (!restored) return reply.status(404).send({ message: "Entry not found" });
      return reply.status(200).send(toFoodEntryResponse(restored));
    },
  );
}
