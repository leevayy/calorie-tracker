package com.calorie.tracker.data.model

import kotlinx.serialization.Serializable

@Serializable
data class Macros(
    val proteinG: Double,
    val carbsG: Double,
    val fatsG: Double
)

@Serializable
data class MealsSummary(
    val breakfastItemCount: Int,
    val lunchItemCount: Int,
    val dinnerItemCount: Int,
    val snackItemCount: Int = 0
)

@Serializable
data class DailyTipRequest(
    val date: String,
    val caloriesConsumedToday: Double,
    val calorieGoal: Double,
    val macrosToday: Macros,
    val mealsSummary: MealsSummary,
    val clientTimeZone: String,
    val localTimeHm: String,
    val preferredLanguage: String
)

@Serializable
data class DailyTipResponse(
    val message: String,
    val generatedAt: String,
    val sourcesUsed: List<String>? = null
)
