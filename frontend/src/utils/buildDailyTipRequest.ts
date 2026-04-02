import type { DailyTipRequest } from "@contracts/daily-tip";
import type { DayLogResponse } from "@contracts/food-log";
import type { PreferredLanguage } from "@contracts/common";
import { browserTimeZone, localTimeHm } from "@/utils/date";

export function buildDailyTipRequest(
  dayLog: DayLogResponse,
  calendarDay: string,
  options: { preferredLanguage: PreferredLanguage; at?: Date },
): DailyTipRequest {
  const at = options.at ?? new Date();
  const { meals } = dayLog;
  const all = [
    ...meals.breakfast,
    ...meals.lunch,
    ...meals.dinner,
    ...(meals.snack ?? []),
  ];
  const macrosToday = all.reduce(
    (acc, e) => ({
      proteinG: acc.proteinG + e.protein,
      carbsG: acc.carbsG + e.carbs,
      fatsG: acc.fatsG + e.fats,
    }),
    { proteinG: 0, carbsG: 0, fatsG: 0 },
  );
  return {
    date: calendarDay,
    caloriesConsumedToday: dayLog.totalCalories,
    calorieGoal: dayLog.calorieGoal,
    macrosToday,
    mealsSummary: {
      breakfastItemCount: meals.breakfast.length,
      lunchItemCount: meals.lunch.length,
      dinnerItemCount: meals.dinner.length,
      snackItemCount: meals.snack?.length ?? 0,
    },
    clientTimeZone: browserTimeZone(),
    localTimeHm: localTimeHm(at),
    preferredLanguage: options.preferredLanguage,
  };
}
