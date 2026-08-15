import type { FoodEntryResponse } from "@contracts/food-log";
import type { HistoryRangeResponse } from "@contracts/history";

export type HistoryEntryChange = {
  entry: FoodEntryResponse;
  direction: 1 | -1;
};

function clamp(value: number): number {
  return Math.max(0, value);
}

export function applyHistoryEntryChanges(
  data: HistoryRangeResponse,
  changes: HistoryEntryChange[],
  today?: string,
): HistoryRangeResponse {
  if (changes.length === 0) return data;

  const changesByDay = new Map<string, HistoryEntryChange[]>();
  for (const change of changes) {
    const existing = changesByDay.get(change.entry.day) ?? [];
    existing.push(change);
    changesByDay.set(change.entry.day, existing);
  }

  let changed = false;
  const days = data.days.map((day) => {
    const dayChanges = changesByDay.get(day.date);
    if (!dayChanges) return day;
    changed = true;
    return dayChanges.reduce(
      (next, { entry, direction }) => ({
        ...next,
        calories: clamp(next.calories + direction * entry.calories),
        protein: clamp(next.protein + direction * entry.protein),
        carbs: clamp(next.carbs + direction * entry.carbs),
        fats: clamp(next.fats + direction * entry.fats),
        fiber: clamp(next.fiber + direction * entry.fiber),
      }),
      day,
    );
  });

  if (!changed) return data;
  const averageDays = days.filter((day) => day.calories > 0 && day.date !== today);
  const weeklyAverageCalories = averageDays.length
    ? Math.round(
        averageDays.reduce((sum, day) => sum + day.calories, 0) / averageDays.length,
      )
    : 0;

  return { ...data, days, weeklyAverageCalories };
}
