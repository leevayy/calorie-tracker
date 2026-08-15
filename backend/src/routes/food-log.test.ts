import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, test } from "vitest";
import type { AiModelPreference } from "../contracts/common.ts";
import {
  registerFoodLogRoutes,
  type FoodEntryRecord,
  type FoodLogRepository,
  type FoodLogUserRecord,
} from "./food-log.ts";

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const ENTRY_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_ENTRY_ID = "20000000-0000-4000-8000-000000000002";
const FIXED_NOW = new Date("2026-08-15T12:00:00.000Z");

function food(overrides: Record<string, unknown> = {}) {
  return {
    name: "Oatmeal",
    calories: 320,
    protein: 14,
    carbs: 52,
    fats: 7,
    fiber: 8,
    portion: "1 bowl",
    ...overrides,
  };
}

function entry(overrides: Partial<FoodEntryRecord> = {}): FoodEntryRecord {
  return {
    id: ENTRY_ID,
    userId: USER_ID,
    day: "2026-08-15",
    mealType: "breakfast",
    ...food(),
    mealSlug: "oatmeal",
    createdAt: new Date("2026-08-15T08:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

class MemoryFoodLogRepository implements FoodLogRepository {
  readonly users = new Map<string, FoodLogUserRecord>([
    [USER_ID, { dailyCalorieGoal: 2_000, aiModelPreference: "qwen3" }],
    [OTHER_USER_ID, { dailyCalorieGoal: 2_200, aiModelPreference: "qwen3" }],
  ]);

  entries: FoodEntryRecord[];
  failBatchAt: number | null = null;

  constructor(entries: FoodEntryRecord[] = []) {
    this.entries = entries.map((item) => ({ ...item }));
  }

  async findUser(userId: string): Promise<FoodLogUserRecord | null> {
    return this.users.get(userId) ?? null;
  }

  async findFrequentFoods(userId: string, from: string, to: string, limit: number) {
    const counts = new Map<string, number>();
    for (const item of this.entries) {
      if (
        item.userId === userId &&
        item.deletedAt === null &&
        item.day >= from &&
        item.day <= to
      ) {
        counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
      .slice(0, limit);
  }

  async findDayEntries(userId: string, day: string): Promise<FoodEntryRecord[]> {
    return this.entries
      .filter((item) => item.userId === userId && item.day === day && item.deletedAt === null)
      .map((item) => ({ ...item }));
  }

  async findActiveEntry(userId: string, entryId: string): Promise<FoodEntryRecord | null> {
    const found = this.entries.find(
      (item) => item.userId === userId && item.id === entryId && item.deletedAt === null,
    );
    return found ? { ...found } : null;
  }

  async createEntriesAtomic(entries: FoodEntryRecord[]): Promise<FoodEntryRecord[]> {
    const next = this.entries.map((item) => ({ ...item }));
    for (const [index, item] of entries.entries()) {
      if (index === this.failBatchAt) throw new Error("simulated write failure");
      next.push({ ...item });
    }
    this.entries = next;
    return entries.map((item) => ({ ...item }));
  }

  async updateEntry(
    userId: string,
    entryId: string,
    changes: Omit<FoodEntryRecord, "id" | "userId" | "createdAt" | "deletedAt">,
  ): Promise<FoodEntryRecord | null> {
    const index = this.entries.findIndex(
      (item) => item.userId === userId && item.id === entryId && item.deletedAt === null,
    );
    if (index < 0) return null;
    const current = this.entries[index];
    if (!current) return null;
    const updated = { ...current, ...changes };
    this.entries[index] = updated;
    return { ...updated };
  }

  async softDeleteEntry(
    userId: string,
    entryId: string,
    deletedAt: Date,
  ): Promise<FoodEntryRecord | null> {
    const index = this.entries.findIndex(
      (item) => item.userId === userId && item.id === entryId && item.deletedAt === null,
    );
    if (index < 0) return null;
    const current = this.entries[index];
    if (!current) return null;
    const deleted = { ...current, deletedAt };
    this.entries[index] = deleted;
    return { ...deleted };
  }

  async restoreEntry(userId: string, entryId: string): Promise<FoodEntryRecord | null> {
    const index = this.entries.findIndex(
      (item) => item.userId === userId && item.id === entryId && item.deletedAt !== null,
    );
    if (index < 0) return null;
    const current = this.entries[index];
    if (!current) return null;
    const restored = { ...current, deletedAt: null };
    this.entries[index] = restored;
    return { ...restored };
  }
}

const apps: FastifyInstance[] = [];

async function buildTestApp(repository: MemoryFoodLogRepository) {
  const app = Fastify();
  apps.push(app);
  app.decorate("authenticate", async (request) => {
    const userId = request.headers["x-test-user-id"];
    Object.assign(request, {
      user: { sub: typeof userId === "string" ? userId : USER_ID },
    });
  });

  let nextId = 10;
  await registerFoodLogRoutes(app, {
    repository,
    createId: () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
    now: () => new Date(FIXED_NOW),
    resolveMealSlug: async (name: string, _context: { aiModelPreference: AiModelPreference }) =>
      `resolved-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  });
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("food log routes", () => {
  test("creates a recognized group across days and meals in one batch", async () => {
    const repository = new MemoryFoodLogRepository();
    const app = await buildTestApp(repository);

    const response = await app.inject({
      method: "POST",
      url: "/entries/batch",
      payload: {
        entries: [
          { day: "2026-08-15", mealType: "breakfast", ...food() },
          {
            day: "2026-08-16",
            mealType: "dinner",
            ...food({ name: "Salmon rice", calories: 610, mealSlug: "fish-rice" }),
          },
        ],
      },
    });
    const firstDay = await app.inject({ method: "GET", url: "/days/2026-08-15" });
    const secondDay = await app.inject({ method: "GET", url: "/days/2026-08-16" });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      entries: [
        {
          day: "2026-08-15",
          mealType: "breakfast",
          name: "Oatmeal",
          mealSlug: "resolved-oatmeal",
        },
        {
          day: "2026-08-16",
          mealType: "dinner",
          name: "Salmon rice",
          mealSlug: "fish-rice",
        },
      ],
    });
    expect(firstDay.json()).toMatchObject({
      totalCalories: 320,
      meals: { breakfast: [{ name: "Oatmeal" }] },
    });
    expect(secondDay.json()).toMatchObject({
      totalCalories: 610,
      meals: { dinner: [{ name: "Salmon rice" }] },
    });
  });

  test("leaves the food log unchanged when any batch write fails", async () => {
    const existing = entry();
    const repository = new MemoryFoodLogRepository([existing]);
    repository.failBatchAt = 1;
    const app = await buildTestApp(repository);

    const response = await app.inject({
      method: "POST",
      url: "/entries/batch",
      payload: {
        entries: [
          { day: "2026-08-15", mealType: "lunch", ...food({ name: "Soup" }) },
          { day: "2026-08-15", mealType: "lunch", ...food({ name: "Bread" }) },
        ],
      },
    });
    const unchanged = await app.inject({ method: "GET", url: "/days/2026-08-15" });

    expect(response.statusCode).toBe(500);
    expect(unchanged.json()).toMatchObject({
      totalCalories: 320,
      meals: {
        breakfast: [{ id: ENTRY_ID, name: "Oatmeal" }],
        lunch: [],
      },
    });
  });

  test("updates every editable field on an owned entry", async () => {
    const repository = new MemoryFoodLogRepository([entry()]);
    const app = await buildTestApp(repository);

    const response = await app.inject({
      method: "PATCH",
      url: `/entries/${ENTRY_ID}`,
      payload: {
        day: "2026-08-16",
        mealType: "lunch",
        ...food({
          name: "Greek yogurt",
          calories: 180,
          protein: 20,
          carbs: 12,
          fats: 5,
          fiber: 1,
          portion: "200 g",
        }),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: ENTRY_ID,
      day: "2026-08-16",
      mealType: "lunch",
      name: "Greek yogurt",
      calories: 180,
      protein: 20,
      carbs: 12,
      fats: 5,
      fiber: 1,
      portion: "200 g",
      mealSlug: "resolved-greek-yogurt",
    });
  });

  test("rejects invalid updates without changing the entry", async () => {
    const original = entry();
    const repository = new MemoryFoodLogRepository([original]);
    const app = await buildTestApp(repository);

    const response = await app.inject({
      method: "PATCH",
      url: `/entries/${ENTRY_ID}`,
      payload: {
        day: "2026-08-16",
        mealType: "lunch",
        ...food({ calories: -1 }),
      },
    });
    const unchanged = await app.inject({ method: "GET", url: "/days/2026-08-15" });

    expect(response.statusCode).toBe(400);
    expect(unchanged.json()).toMatchObject({
      totalCalories: 320,
      meals: { breakfast: [{ id: ENTRY_ID, day: "2026-08-15", calories: 320 }] },
    });
  });

  test("returns not found when updating another user's entry", async () => {
    const foreign = entry({ userId: OTHER_USER_ID });
    const repository = new MemoryFoodLogRepository([foreign]);
    const app = await buildTestApp(repository);

    const response = await app.inject({
      method: "PATCH",
      url: `/entries/${ENTRY_ID}`,
      payload: { day: "2026-08-16", mealType: "lunch", ...food() },
    });
    const unchangedForOwner = await app.inject({
      method: "GET",
      url: "/days/2026-08-15",
      headers: { "x-test-user-id": OTHER_USER_ID },
    });

    expect(response.statusCode).toBe(404);
    expect(unchangedForOwner.json()).toMatchObject({
      totalCalories: 320,
      meals: { breakfast: [{ id: ENTRY_ID, day: "2026-08-15", calories: 320 }] },
    });
  });

  test("moves one entry without leaving a duplicate at the source", async () => {
    const repository = new MemoryFoodLogRepository([entry()]);
    const app = await buildTestApp(repository);

    const moved = await app.inject({
      method: "PATCH",
      url: `/entries/${ENTRY_ID}`,
      payload: { day: "2026-08-16", mealType: "dinner", ...food() },
    });
    const source = await app.inject({ method: "GET", url: "/days/2026-08-15" });
    const destination = await app.inject({ method: "GET", url: "/days/2026-08-16" });

    expect(moved.statusCode).toBe(200);
    expect(source.json()).toMatchObject({ totalCalories: 0, meals: { breakfast: [] } });
    expect(destination.json()).toMatchObject({
      totalCalories: 320,
      meals: { dinner: [{ id: ENTRY_ID }] },
    });
  });

  test("soft-deletes and restores the complete owned entry while enforcing ownership", async () => {
    const owned = entry();
    const foreign = entry({ id: OTHER_ENTRY_ID, userId: OTHER_USER_ID, name: "Foreign food" });
    const repository = new MemoryFoodLogRepository([owned, foreign]);
    const app = await buildTestApp(repository);

    const deleted = await app.inject({ method: "DELETE", url: `/entries/${ENTRY_ID}` });
    const hidden = await app.inject({ method: "GET", url: "/days/2026-08-15" });
    const absentFromFrequent = await app.inject({
      method: "GET",
      url: "/frequent-foods?from=2026-08-15&to=2026-08-15&limit=3",
    });
    const foreignDelete = await app.inject({
      method: "DELETE",
      url: `/entries/${OTHER_ENTRY_ID}`,
    });
    const foreignRestore = await app.inject({
      method: "POST",
      url: `/entries/${ENTRY_ID}/restore`,
      headers: { "x-test-user-id": OTHER_USER_ID },
    });
    const restored = await app.inject({ method: "POST", url: `/entries/${ENTRY_ID}/restore` });
    const visibleAgain = await app.inject({ method: "GET", url: "/days/2026-08-15" });

    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toMatchObject({
      id: ENTRY_ID,
      day: "2026-08-15",
      mealType: "breakfast",
      name: "Oatmeal",
      calories: 320,
    });
    expect(hidden.json()).toMatchObject({ totalCalories: 0, meals: { breakfast: [] } });
    expect(absentFromFrequent.json()).toEqual({ items: [] });
    expect(foreignDelete.statusCode).toBe(404);
    expect(foreignRestore.statusCode).toBe(404);
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ id: ENTRY_ID, name: "Oatmeal", calories: 320 });
    expect(visibleAgain.json()).toMatchObject({
      totalCalories: 320,
      meals: { breakfast: [{ id: ENTRY_ID }] },
    });
  });
});
