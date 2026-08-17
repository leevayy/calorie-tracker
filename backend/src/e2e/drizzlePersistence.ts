import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { db } from "../db/client.ts";
import { foodEntriesTable, usersTable } from "../db/schema.ts";
import { sanitizeMealSlug } from "../services/slugShape.ts";
import type {
  E2EControlPersistence,
  E2ESeedEntry,
  E2ESeedRequest,
  E2ESeedResult,
} from "./control.ts";

export function assertDedicatedE2EDatabaseUrl(databaseUrl: string): void {
  let databaseName: string;
  try {
    const parsed = new URL(databaseUrl);
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    throw new Error("E2E controls require a dedicated test database URL");
  }

  if (!/(?:^|[-_])(test|e2e)(?:[-_]|$)/i.test(databaseName)) {
    throw new Error("E2E controls require a dedicated test database name containing test or e2e");
  }
}

function entryRecord(
  input: E2ESeedEntry,
  userId: string,
  entryIndex: number,
) {
  const id = randomUUID();
  const fallbackSlug = `e2e-${entryIndex + 1}`;
  return {
    id,
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
    mealSlug: input.mealSlug === null
      ? null
      : input.mealSlug
        ? (sanitizeMealSlug(input.mealSlug) ?? fallbackSlug)
        : fallbackSlug,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, entryIndex)),
    deletedAt: null,
  };
}

export function createDrizzleE2EControlPersistence(
  databaseUrl: string,
): E2EControlPersistence {
  assertDedicatedE2EDatabaseUrl(databaseUrl);

  return {
    async resetAndSeed(input: E2ESeedRequest): Promise<E2ESeedResult> {
      const users = await Promise.all(
        input.users.map(async (inputUser) => ({
          id: randomUUID(),
          email: inputUser.email.toLocaleLowerCase(),
          passwordHash: await hash(inputUser.password, 4),
          dailyCalorieGoal: inputUser.profile?.dailyCalorieGoal ?? 2_000,
          weightKg: inputUser.profile?.weightKg ?? null,
          heightCm: inputUser.profile?.heightCm ?? null,
          preferredLanguage: inputUser.profile?.preferredLanguage ?? "en",
          nutritionGoal: inputUser.profile?.nutritionGoal ?? "maintain",
        })),
      );

      let entryIndex = 0;
      const entriesByUser = input.users.map((inputUser, userIndex) => {
        const user = users[userIndex];
        if (!user) throw new Error("E2E seed user preparation failed");
        return (inputUser.entries ?? []).map((inputEntry) =>
          entryRecord(inputEntry, user.id, entryIndex++),
        );
      });
      const entries = entriesByUser.flat();

      await db.transaction(async (transaction) => {
        await transaction.delete(foodEntriesTable);
        await transaction.delete(usersTable);
        if (users.length > 0) await transaction.insert(usersTable).values(users);
        if (entries.length > 0) await transaction.insert(foodEntriesTable).values(entries);
      });

      return {
        users: users.map((user, index) => ({
          id: user.id,
          email: user.email,
          entryIds: (entriesByUser[index] ?? []).map((entry) => entry.id),
        })),
      };
    },
  };
}
