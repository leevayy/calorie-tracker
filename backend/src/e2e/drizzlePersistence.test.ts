import { beforeEach, describe, expect, test, vi } from "vitest";

const { deletedTables, insertedBatches, transaction } = vi.hoisted(() => {
  const deletedTables: unknown[] = [];
  const insertedBatches: unknown[][] = [];
  const transaction = vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) =>
    callback({
      delete: vi.fn(async (table: unknown) => {
        deletedTables.push(table);
      }),
      insert: vi.fn((_table: unknown) => ({
        values: vi.fn(async (values: unknown[]) => {
          insertedBatches.push(values);
        }),
      })),
    }),
  );
  return { deletedTables, insertedBatches, transaction };
});

vi.mock("../db/client.ts", () => ({ db: { transaction } }));
vi.mock("bcryptjs", () => ({ hash: vi.fn(async (password: string) => `hashed:${password}`) }));

import {
  assertDedicatedE2EDatabaseUrl,
  createDrizzleE2EControlPersistence,
} from "./drizzlePersistence.ts";

beforeEach(() => {
  deletedTables.splice(0);
  insertedBatches.splice(0);
  transaction.mockClear();
});

describe("E2E database safety", () => {
  test.each([
    "postgresql://user:pass@localhost/calorie_tracker",
    "postgresql://user:pass@localhost/production",
    "not-a-database-url",
  ])("rejects a database that is not visibly dedicated to tests: %s", (databaseUrl) => {
    expect(() => assertDedicatedE2EDatabaseUrl(databaseUrl)).toThrow(/dedicated test database/i);
  });

  test.each([
    "postgresql://user:pass@localhost/test",
    "postgresql://user:pass@localhost/calorie_tracker_test",
    "postgresql://user:pass@localhost/calorie-tracker-e2e",
  ])("accepts a visibly dedicated test database: %s", (databaseUrl) => {
    expect(() => assertDedicatedE2EDatabaseUrl(databaseUrl)).not.toThrow();
  });
});

describe("E2E database reset and seed", () => {
  test("atomically clears the database and inserts isolated users and historical entries", async () => {
    const persistence = createDrizzleE2EControlPersistence(
      "postgresql://user:pass@localhost/calorie_tracker_e2e",
    );

    const result = await persistence.resetAndSeed({
      users: [
        {
          email: "FIRST@EXAMPLE.TEST",
          password: "password-one",
          profile: { dailyCalorieGoal: 2_200, nutritionGoal: "muscle_gain" },
          entries: [
            {
              day: "2026-08-14",
              mealType: "dinner",
              name: "Rice bowl",
              calories: 600,
              protein: 35,
              carbs: 80,
              fats: 15,
              fiber: 8,
              portion: "1 bowl",
              mealSlug: "rice-bowl",
            },
          ],
        },
        {
          email: "second@example.test",
          password: "password-two",
        },
      ],
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(deletedTables).toHaveLength(2);
    expect(insertedBatches).toHaveLength(2);
    const users = insertedBatches[0] as Array<Record<string, unknown>>;
    const entries = insertedBatches[1] as Array<Record<string, unknown>>;
    expect(users).toHaveLength(2);
    expect(users[0]).toMatchObject({
      email: "first@example.test",
      passwordHash: "hashed:password-one",
      dailyCalorieGoal: 2_200,
      nutritionGoal: "muscle_gain",
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      userId: users[0]?.id,
      name: "Rice bowl",
      day: "2026-08-14",
      mealSlug: "rice-bowl",
    });
    expect(result.users).toEqual([
      {
        id: users[0]?.id,
        email: "first@example.test",
        entryIds: [entries[0]?.id],
      },
      {
        id: users[1]?.id,
        email: "second@example.test",
        entryIds: [],
      },
    ]);
  });

  test("preserves an explicit null meal slug while defaulting an omitted fixture slug", async () => {
    const persistence = createDrizzleE2EControlPersistence(
      "postgresql://user:pass@localhost/calorie_tracker_e2e",
    );
    const baseEntry = {
      day: "2026-08-14",
      mealType: "breakfast" as const,
      calories: 300,
      protein: 10,
      carbs: 50,
      fats: 7,
      fiber: 6,
    };

    await persistence.resetAndSeed({
      users: [{
        email: "legacy@example.test",
        password: "password-legacy",
        entries: [
          { ...baseEntry, name: "Legacy oats", mealSlug: null },
          { ...baseEntry, name: "Fresh oats" },
        ],
      }],
    });

    const entries = insertedBatches[1] as Array<Record<string, unknown>>;
    expect(entries.map(({ name, mealSlug }) => ({ name, mealSlug }))).toEqual([
      { name: "Legacy oats", mealSlug: null },
      { name: "Fresh oats", mealSlug: "e2e-2" },
    ]);
  });
});
