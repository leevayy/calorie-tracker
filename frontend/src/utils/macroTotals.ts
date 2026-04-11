import type { DayLogResponse } from "@contracts/food-log";

export type MacroGramTotals = { protein: number; carbs: number; fats: number };

export function sumDayMacros(day: DayLogResponse): MacroGramTotals {
  const { meals } = day;
  const all = [
    ...meals.breakfast,
    ...meals.lunch,
    ...meals.dinner,
    ...(meals.snack ?? []),
  ];
  return all.reduce(
    (acc, e) => ({
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fats: acc.fats + e.fats,
    }),
    { protein: 0, carbs: 0, fats: 0 },
  );
}

/** Compact display: integers when whole, else one decimal */
export function formatMacroGrams(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 10) / 10;
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
}
