import type { DayLogResponse, FoodEntryResponse } from "@contracts/food-log";
import type { MealType } from "@contracts/common";

const MEAL_KEYS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export function mergeFoodEntry(data: DayLogResponse, entry: FoodEntryResponse): DayLogResponse {
  const meals = { ...data.meals };
  const key = entry.mealType;
  const prev = key === "snack" ? meals.snack ?? [] : meals[key];
  const bucket = [...prev, entry];
  if (key === "snack") {
    meals.snack = bucket;
  } else {
    (meals as Record<"breakfast" | "lunch" | "dinner", FoodEntryResponse[]>)[key] = bucket;
  }
  return {
    ...data,
    meals,
    totalCalories: data.totalCalories + entry.calories,
  };
}

export function removeFoodEntryById(data: DayLogResponse, entryId: string): DayLogResponse | null {
  let removedCalories = 0;
  let found = false;
  const meals = { ...data.meals };

  for (const mt of MEAL_KEYS) {
    const bucket = mt === "snack" ? meals.snack : meals[mt as "breakfast" | "lunch" | "dinner"];
    if (!bucket?.length) continue;
    const idx = bucket.findIndex((e) => e.id === entryId);
    if (idx < 0) continue;
    removedCalories = bucket[idx].calories;
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
    totalCalories: Math.max(0, data.totalCalories - removedCalories),
  };
}
