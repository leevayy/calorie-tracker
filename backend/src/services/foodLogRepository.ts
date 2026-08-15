import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { foodEntriesTable, usersTable } from "../db/schema.ts";

export type FoodLogUserRecord = {
  dailyCalorieGoal: number;
  aiModelPreference: string;
};

export type FoodEntryRecord = {
  id: string;
  userId: string;
  day: string;
  mealType: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  portion: string | null;
  mealSlug: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};

export type FoodEntryUpdate = Omit<
  FoodEntryRecord,
  "id" | "userId" | "createdAt" | "deletedAt"
>;

export type FrequentFoodRecord = {
  name: string;
  count: number;
};

class IncompleteFoodEntryBatchError extends Error {}

export interface FoodLogRepository {
  findUser(userId: string): Promise<FoodLogUserRecord | null>;
  findFrequentFoods(
    userId: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<FrequentFoodRecord[]>;
  findDayEntries(userId: string, day: string): Promise<FoodEntryRecord[]>;
  findActiveEntry(userId: string, entryId: string): Promise<FoodEntryRecord | null>;
  createEntriesAtomic(entries: FoodEntryRecord[]): Promise<FoodEntryRecord[]>;
  updateEntry(
    userId: string,
    entryId: string,
    changes: FoodEntryUpdate,
  ): Promise<FoodEntryRecord | null>;
  softDeleteEntry(
    userId: string,
    entryId: string,
    deletedAt: Date,
  ): Promise<FoodEntryRecord | null>;
  softDeleteEntriesAtomic(
    userId: string,
    entryIds: string[],
    deletedAt: Date,
  ): Promise<FoodEntryRecord[] | null>;
  restoreEntry(userId: string, entryId: string): Promise<FoodEntryRecord | null>;
}

export const drizzleFoodLogRepository: FoodLogRepository = {
  async findUser(userId) {
    const user = await db.query.usersTable.findFirst({
      columns: {
        dailyCalorieGoal: true,
        aiModelPreference: true,
      },
      where: eq(usersTable.id, userId),
    });
    return user ?? null;
  },

  async findFrequentFoods(userId, from, to, limit) {
    const countSql = sql<number>`cast(count(*) as int)`;
    return db
      .select({
        name: foodEntriesTable.name,
        count: countSql,
      })
      .from(foodEntriesTable)
      .where(
        and(
          eq(foodEntriesTable.userId, userId),
          gte(foodEntriesTable.day, from),
          lte(foodEntriesTable.day, to),
          isNull(foodEntriesTable.deletedAt),
        ),
      )
      .groupBy(foodEntriesTable.name)
      .orderBy(desc(countSql), asc(foodEntriesTable.name))
      .limit(limit);
  },

  async findDayEntries(userId, day) {
    return db.query.foodEntriesTable.findMany({
      where: and(
        eq(foodEntriesTable.userId, userId),
        eq(foodEntriesTable.day, day),
        isNull(foodEntriesTable.deletedAt),
      ),
      orderBy: (table, { asc }) => [asc(table.createdAt)],
    });
  },

  async findActiveEntry(userId, entryId) {
    const entry = await db.query.foodEntriesTable.findFirst({
      where: and(
        eq(foodEntriesTable.id, entryId),
        eq(foodEntriesTable.userId, userId),
        isNull(foodEntriesTable.deletedAt),
      ),
    });
    return entry ?? null;
  },

  async createEntriesAtomic(entries) {
    await db.transaction(async (transaction) => {
      await transaction.insert(foodEntriesTable).values(entries);
    });
    return entries;
  },

  async updateEntry(userId, entryId, changes) {
    const rows = await db
      .update(foodEntriesTable)
      .set(changes)
      .where(
        and(
          eq(foodEntriesTable.id, entryId),
          eq(foodEntriesTable.userId, userId),
          isNull(foodEntriesTable.deletedAt),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },

  async softDeleteEntry(userId, entryId, deletedAt) {
    const rows = await db
      .update(foodEntriesTable)
      .set({ deletedAt })
      .where(
        and(
          eq(foodEntriesTable.id, entryId),
          eq(foodEntriesTable.userId, userId),
          isNull(foodEntriesTable.deletedAt),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },

  async softDeleteEntriesAtomic(userId, entryIds, deletedAt) {
    const uniqueIds = [...new Set(entryIds)];
    try {
      return await db.transaction(async (transaction) => {
        const rows = await transaction
          .update(foodEntriesTable)
          .set({ deletedAt })
          .where(
            and(
              eq(foodEntriesTable.userId, userId),
              inArray(foodEntriesTable.id, uniqueIds),
              isNull(foodEntriesTable.deletedAt),
            ),
          )
          .returning();
        if (rows.length !== uniqueIds.length) throw new IncompleteFoodEntryBatchError();
        return rows;
      });
    } catch (error) {
      if (error instanceof IncompleteFoodEntryBatchError) return null;
      throw error;
    }
  },

  async restoreEntry(userId, entryId) {
    const rows = await db
      .update(foodEntriesTable)
      .set({ deletedAt: null })
      .where(
        and(
          eq(foodEntriesTable.id, entryId),
          eq(foodEntriesTable.userId, userId),
          isNotNull(foodEntriesTable.deletedAt),
        ),
      )
      .returning();
    return rows[0] ?? null;
  },
};
