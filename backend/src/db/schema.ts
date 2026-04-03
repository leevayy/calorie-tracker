import { index, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  dailyCalorieGoal: real("daily_calorie_goal").notNull().default(2000),
  weightKg: real("weight_kg"),
  heightCm: real("height_cm"),
  preferredLanguage: text("preferred_language").notNull().default("en"),
  nutritionGoal: text("nutrition_goal").notNull().default("maintain"),
  aiModelPreference: text("ai_model_preference").notNull().default("deepseek"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const foodEntriesTable = pgTable(
  "food_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    mealType: text("meal_type").notNull(),
    name: text("name").notNull(),
    calories: real("calories").notNull(),
    protein: real("protein").notNull(),
    carbs: real("carbs").notNull(),
    fats: real("fats").notNull(),
    portion: text("portion"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userDayIdx: index("food_entries_user_day_idx").on(table.userId, table.day),
    userDayMealIdx: index("food_entries_user_day_meal_idx").on(table.userId, table.day, table.mealType),
  }),
);
