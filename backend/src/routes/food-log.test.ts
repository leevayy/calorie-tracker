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
    [USER_ID, { dailyCalorieGoal: 2_000 }],
    [OTHER_USER_ID, { dailyCalorieGoal: 2_200 }],
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

  async findHistoricalFoodSuggestions(userId: string, query: string, limit: number) {
    const normalized = query.trim().toLocaleLowerCase();
    const groups = new Map<string, {
      name: string;
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
      fiber: number;
      portion: string | null;
      mealSlug: string | null;
      usageCount: number;
      lastUsedDay: string;
    }>();

    for (const item of this.entries) {
      if (
        item.userId !== userId ||
        item.deletedAt !== null ||
        !item.name.toLocaleLowerCase().includes(normalized)
      ) continue;
      const key = JSON.stringify([
        item.name,
        item.portion,
        item.calories,
        item.protein,
        item.carbs,
        item.fats,
        item.fiber,
        item.mealSlug,
      ]);
      const current = groups.get(key);
      if (current) {
        current.usageCount += 1;
        if (item.day > current.lastUsedDay) current.lastUsedDay = item.day;
      } else {
        groups.set(key, {
          name: item.name,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fats: item.fats,
          fiber: item.fiber,
          portion: item.portion,
          mealSlug: item.mealSlug,
          usageCount: 1,
          lastUsedDay: item.day,
        });
      }
    }

    const relevance = (name: string) => {
      const normalizedName = name.toLocaleLowerCase();
      return normalizedName === normalized ? 3 : normalizedName.startsWith(normalized) ? 2 : 1;
    };
    return [...groups.values()]
      .sort((left, right) =>
        relevance(right.name) - relevance(left.name) ||
        right.usageCount - left.usageCount ||
        right.lastUsedDay.localeCompare(left.lastUsedDay) ||
        left.name.localeCompare(right.name),
      )
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

  async softDeleteEntriesAtomic(
    userId: string,
    entryIds: string[],
    deletedAt: Date,
  ): Promise<FoodEntryRecord[] | null> {
    const ids = new Set(entryIds);
    const matches = this.entries.filter(
      (item) => item.userId === userId && ids.has(item.id) && item.deletedAt === null,
    );
    if (matches.length !== ids.size) return null;
    this.entries = this.entries.map((item) =>
      matches.some((match) => match.id === item.id) ? { ...item, deletedAt } : item,
    );
    return matches.map((item) => ({ ...item, deletedAt }));
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
  test("keeps materially different historical configurations distinct when their slugs differ", async () => {
    const entries = [
      entry({
        day: "2026-08-01",
        name: "Greek yogurt",
        portion: "100 g",
        calories: 90,
        mealSlug: "greek-yogurt-100g",
      }),
      entry({
        id: "10000000-0000-4000-8000-000000000002",
        day: "2026-08-12",
        name: "Greek yogurt",
        portion: "100 g",
        calories: 90,
        mealSlug: "greek-yogurt-100g",
      }),
      entry({
        id: "10000000-0000-4000-8000-000000000003",
        day: "2026-08-14",
        name: "Greek yogurt",
        portion: "200 g",
        calories: 180,
        mealSlug: "greek-yogurt-200g",
      }),
      entry({
        id: "10000000-0000-4000-8000-000000000004",
        day: "2026-08-15",
        name: "Vanilla Greek yogurt",
        mealSlug: "vanilla-greek-yogurt",
      }),
      entry({
        id: "10000000-0000-4000-8000-000000000005",
        name: "Foreign yogurt",
        userId: OTHER_USER_ID,
      }),
      entry({
        id: "10000000-0000-4000-8000-000000000006",
        name: "Deleted yogurt",
        deletedAt: FIXED_NOW,
      }),
    ];
    const app = await buildTestApp(new MemoryFoodLogRepository(entries));

    const response = await app.inject({
      method: "GET",
      url: "/food-suggestions?query=greek&limit=3",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [
        { name: "Greek yogurt", portion: "100 g", calories: 90, usageCount: 2, lastUsedDay: "2026-08-12" },
        { name: "Greek yogurt", portion: "200 g", calories: 180, usageCount: 1, lastUsedDay: "2026-08-14" },
        { name: "Vanilla Greek yogurt", usageCount: 1, lastUsedDay: "2026-08-15" },
      ],
    });
  });

  test("keeps the highest-ranked configuration per non-empty slug while null slugs stay unique", async () => {
    const entries = [
      entry({
        day: "2026-08-01",
        name: "Fried eggs",
        portion: "1 egg",
        calories: 100,
        mealSlug: "fried-eggs",
      }),
      entry({
        id: "10000000-0000-4000-8000-000000000002",
        day: "2026-08-10",
        name: "Fried eggs",
        portion: "2 eggs",
        calories: 200,
        mealSlug: "fried-eggs",
      }),
      entry({
        id: "10000000-0000-4000-8000-000000000003",
        day: "2026-08-12",
        name: "Fried eggs",
        portion: "2 eggs",
        calories: 200,
        mealSlug: "fried-eggs",
      }),
      entry({
        id: "10000000-0000-4000-8000-000000000004",
        day: "2026-08-15",
        name: "Fried eggs with spinach",
        mealSlug: null,
      }),
      entry({
        id: "10000000-0000-4000-8000-000000000005",
        day: "2026-08-14",
        name: "Fried eggs with tomato",
        mealSlug: null,
      }),
    ];
    const app = await buildTestApp(new MemoryFoodLogRepository(entries));

    const response = await app.inject({
      method: "GET",
      url: "/food-suggestions?query=fried%20eggs&limit=8",
    });

    expect(response.json().items.map((item: Record<string, unknown>) => ({
      name: item.name,
      portion: item.portion,
      mealSlug: item.mealSlug,
      usageCount: item.usageCount,
      lastUsedDay: item.lastUsedDay,
    }))).toEqual([
      {
        name: "Fried eggs",
        portion: "2 eggs",
        mealSlug: "fried-eggs",
        usageCount: 2,
        lastUsedDay: "2026-08-12",
      },
      {
        name: "Fried eggs with spinach",
        portion: "1 bowl",
        mealSlug: undefined,
        usageCount: 1,
        lastUsedDay: "2026-08-15",
      },
      {
        name: "Fried eggs with tomato",
        portion: "1 bowl",
        mealSlug: undefined,
        usageCount: 1,
        lastUsedDay: "2026-08-14",
      },
    ]);
  });

  test("treats empty slugs as missing and keeps those suggestions individually unique", async () => {
    const app = await buildTestApp(new MemoryFoodLogRepository([
      entry({ name: "Fried tofu", mealSlug: "" }),
      entry({
        id: "10000000-0000-4000-8000-000000000002",
        day: "2026-08-14",
        name: "Fried tempeh",
        mealSlug: "",
      }),
    ]));

    const response = await app.inject({
      method: "GET",
      url: "/food-suggestions?query=fried&limit=8",
    });

    expect({
      statusCode: response.statusCode,
      items: response.statusCode === 200
        ? response.json().items.map((item: Record<string, unknown>) => ({
            name: item.name,
            mealSlug: item.mealSlug,
          }))
        : response.json(),
    }).toEqual({
      statusCode: 200,
      items: [
        { name: "Fried tofu", mealSlug: undefined },
        { name: "Fried tempeh", mealSlug: undefined },
      ],
    });
  });

  test("filters only the requested ranked candidate set without backfilling after a slug merge", async () => {
    const app = await buildTestApp(new MemoryFoodLogRepository([
      entry({
        day: "2026-08-15",
        name: "Apple",
        calories: 80,
        mealSlug: "apple",
      }),
      entry({
        id: "10000000-0000-4000-8000-000000000002",
        day: "2026-08-14",
        name: "Apple",
        calories: 95,
        mealSlug: "apple",
      }),
      entry({
        id: "10000000-0000-4000-8000-000000000003",
        day: "2026-08-13",
        name: "Apple slices",
        calories: 70,
        mealSlug: "apple-slices",
      }),
    ]));

    const response = await app.inject({
      method: "GET",
      url: "/food-suggestions?query=apple&limit=2",
    });

    expect(response.json().items.map((item: Record<string, unknown>) => ({
      name: item.name,
      calories: item.calories,
      mealSlug: item.mealSlug,
    }))).toEqual([
      { name: "Apple", calories: 80, mealSlug: "apple" },
    ]);
  });

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

  test("does not expose the retired path-based single-entry create route", async () => {
    const repository = new MemoryFoodLogRepository();
    const app = await buildTestApp(repository);

    const response = await app.inject({
      method: "POST",
      url: "/days/2026-08-15/entries",
      payload: { mealType: "breakfast", ...food() },
    });

    expect(response.statusCode).toBe(404);
    expect(repository.entries).toEqual([]);
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

  test("duplicates an owned meal atomically with its exact stored nutrition", async () => {
    const first = entry({ day: "2026-08-12", mealType: "dinner" });
    const second = entry({
      id: "22222222-2222-4222-8222-222222222222",
      day: "2026-08-12",
      mealType: "dinner",
      name: "Salad",
      calories: 180,
      protein: 5,
      carbs: 16,
      fats: 11,
      fiber: 6,
      portion: "1 plate",
      mealSlug: "salad",
    });
    const repository = new MemoryFoodLogRepository([first, second]);
    const app = await buildTestApp(repository);

    const response = await app.inject({
      method: "POST",
      url: "/meals/duplicate",
      payload: {
        sourceDay: "2026-08-12",
        sourceMealType: "dinner",
        destinationDay: "2026-08-15",
        destinationMealType: "lunch",
      },
    });
    const source = await app.inject({ method: "GET", url: "/days/2026-08-12" });
    const destination = await app.inject({ method: "GET", url: "/days/2026-08-15" });

    expect(response.statusCode).toBe(201);
    expect(response.json().entries).toMatchObject([
      {
        day: "2026-08-15",
        mealType: "lunch",
        name: "Oatmeal",
        calories: 320,
        protein: 14,
        carbs: 52,
        fats: 7,
        fiber: 8,
        portion: "1 bowl",
        mealSlug: "oatmeal",
      },
      {
        day: "2026-08-15",
        mealType: "lunch",
        name: "Salad",
        calories: 180,
        protein: 5,
        carbs: 16,
        fats: 11,
        fiber: 6,
        portion: "1 plate",
        mealSlug: "salad",
      },
    ]);
    expect(source.json()).toMatchObject({
      totalCalories: 500,
      meals: { dinner: [{ id: first.id }, { id: second.id }] },
    });
    expect(destination.json()).toMatchObject({
      totalCalories: 500,
      meals: { lunch: [{ name: "Oatmeal" }, { name: "Salad" }] },
    });
  });

  test("rolls back a failed meal duplication and hides another user's source meal", async () => {
    const first = entry({ day: "2026-08-12", mealType: "dinner" });
    const second = entry({
      id: "22222222-2222-4222-8222-222222222222",
      day: "2026-08-12",
      mealType: "dinner",
      name: "Salad",
    });
    const foreign = entry({
      id: OTHER_ENTRY_ID,
      userId: OTHER_USER_ID,
      day: "2026-08-11",
      mealType: "lunch",
    });
    const repository = new MemoryFoodLogRepository([first, second, foreign]);
    repository.failBatchAt = 1;
    const app = await buildTestApp(repository);

    const failed = await app.inject({
      method: "POST",
      url: "/meals/duplicate",
      payload: {
        sourceDay: "2026-08-12",
        sourceMealType: "dinner",
        destinationDay: "2026-08-15",
        destinationMealType: "breakfast",
      },
    });
    const foreignSource = await app.inject({
      method: "POST",
      url: "/meals/duplicate",
      payload: {
        sourceDay: "2026-08-11",
        sourceMealType: "lunch",
        destinationDay: "2026-08-15",
        destinationMealType: "breakfast",
      },
    });

    expect(failed.statusCode).toBe(500);
    expect(foreignSource.statusCode).toBe(404);
    expect(repository.entries).toHaveLength(3);
    expect(repository.entries.map((item) => item.id)).toEqual([first.id, second.id, foreign.id]);
  });

  test("undoes a multi-food logging submission atomically", async () => {
    const first = entry();
    const second = entry({
      id: "22222222-2222-4222-8222-222222222222",
      mealType: "lunch",
      name: "Soup",
    });
    const repository = new MemoryFoodLogRepository([first, second]);
    const app = await buildTestApp(repository);

    const response = await app.inject({
      method: "DELETE",
      url: "/entries/batch",
      payload: { entryIds: [first.id, second.id] },
    });
    const day = await app.inject({ method: "GET", url: "/days/2026-08-15" });

    expect(response.statusCode).toBe(200);
    expect(response.json().entries).toHaveLength(2);
    expect(day.json().totalCalories).toBe(0);
  });

  test("does not partially undo a logging submission outside the owner boundary", async () => {
    const owned = entry();
    const other = entry({
      id: "22222222-2222-4222-8222-222222222222",
      userId: OTHER_USER_ID,
    });
    const repository = new MemoryFoodLogRepository([owned, other]);
    const app = await buildTestApp(repository);

    const response = await app.inject({
      method: "DELETE",
      url: "/entries/batch",
      payload: { entryIds: [owned.id, other.id] },
    });

    expect(response.statusCode).toBe(404);
    expect(repository.entries.every((item) => item.deletedAt === null)).toBe(true);
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
