package com.calorie.tracker.util

import com.calorie.tracker.data.model.DailyTipRequest
import com.calorie.tracker.data.model.DayLogResponse
import com.calorie.tracker.data.model.Macros
import com.calorie.tracker.data.model.MealsSummary

fun buildDailyTipRequest(
    dayLog: DayLogResponse,
    calendarDay: String,
    preferredLanguage: String
): DailyTipRequest {
    val meals = dayLog.meals
    val all = meals.breakfast + meals.lunch + meals.dinner + meals.snack
    val macros = all.fold(Macros(0.0, 0.0, 0.0)) { acc, e ->
        Macros(acc.proteinG + e.protein, acc.carbsG + e.carbs, acc.fatsG + e.fats)
    }
    return DailyTipRequest(
        date = calendarDay,
        caloriesConsumedToday = dayLog.totalCalories,
        calorieGoal = dayLog.calorieGoal,
        macrosToday = macros,
        mealsSummary = MealsSummary(
            breakfastItemCount = meals.breakfast.size,
            lunchItemCount = meals.lunch.size,
            dinnerItemCount = meals.dinner.size,
            snackItemCount = meals.snack.size
        ),
        clientTimeZone = browserTimeZone(),
        localTimeHm = localTimeHm(),
        preferredLanguage = preferredLanguage
    )
}
