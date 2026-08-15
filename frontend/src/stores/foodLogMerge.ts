import type { DayLogResponse, FoodEntryResponse } from "@contracts/food-log";
import type { MealType } from "@contracts/common";

const MEAL_KEYS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function totalCalories(meals: DayLogResponse["meals"]): number {
  return MEAL_KEYS.reduce((sum, mealType) => {
    const bucket =
      mealType === "snack"
        ? meals.snack ?? []
        : meals[mealType as "breakfast" | "lunch" | "dinner"];
    return sum + bucket.reduce((mealSum, entry) => mealSum + entry.calories, 0);
  }, 0);
}

function byCreatedAt(a: FoodEntryResponse, b: FoodEntryResponse): number {
  return a.createdAt.localeCompare(b.createdAt);
}

export function mergeFoodEntry(data: DayLogResponse, entry: FoodEntryResponse): DayLogResponse {
  const meals = { ...data.meals };
  const key = entry.mealType;
  const prev = key === "snack" ? meals.snack ?? [] : meals[key];
  const bucket = [...prev.filter((item) => item.id !== entry.id), entry].sort(byCreatedAt);
  if (key === "snack") {
    meals.snack = bucket;
  } else {
    (meals as Record<"breakfast" | "lunch" | "dinner", FoodEntryResponse[]>)[key] = bucket;
  }
  return {
    ...data,
    meals,
    totalCalories: totalCalories(meals),
  };
}

export function mergeFoodEntries(
  data: DayLogResponse,
  entries: FoodEntryResponse[],
): DayLogResponse {
  return entries
    .filter((entry) => entry.day === data.day)
    .reduce((next, entry) => mergeFoodEntry(next, entry), data);
}

export function removeFoodEntryById(data: DayLogResponse, entryId: string): DayLogResponse | null {
  let found = false;
  const meals = { ...data.meals };

  for (const mt of MEAL_KEYS) {
    const bucket = mt === "snack" ? meals.snack : meals[mt as "breakfast" | "lunch" | "dinner"];
    if (!bucket?.length) continue;
    const idx = bucket.findIndex((e) => e.id === entryId);
    if (idx < 0) continue;
    const next = bucket.filter((_, i) => i !== idx);
    if (mt === "snack") {
      meals.snack = next.length ? next : undefined;
    } else {
      (meals as Record<"breakfast" | "lunch" | "dinner", FoodEntryResponse[]>)[mt] = next;
    }
    found = true;
    break;
  }

  if (!found) return null;
  return {
    ...data,
    meals,
    totalCalories: totalCalories(meals),
  };
}

export function replaceFoodEntry(
  data: DayLogResponse,
  before: FoodEntryResponse,
  after: FoodEntryResponse,
): DayLogResponse {
  let next = data;
  if (before.day === data.day) {
    next = removeFoodEntryById(next, before.id) ?? next;
  }
  if (after.day === data.day) {
    next = mergeFoodEntry(next, after);
  }
  return next;
}
