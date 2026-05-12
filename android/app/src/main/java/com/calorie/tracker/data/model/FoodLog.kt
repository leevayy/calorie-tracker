package com.calorie.tracker.data.model

import kotlinx.serialization.Serializable

@Serializable
data class FoodEntryResponse(
    val id: String,
    val name: String,
    val calories: Double,
    val protein: Double,
    val carbs: Double,
    val fats: Double,
    val fiber: Double,
    val portion: String? = null,
    val mealSlug: String? = null,
    val mealType: String,
    val day: String,
    val createdAt: String
)

@Serializable
data class CreateFoodEntryBody(
    val mealType: String,
    val name: String,
    val calories: Double,
    val protein: Double,
    val carbs: Double,
    val fats: Double,
    val fiber: Double,
    val portion: String? = null,
    val mealSlug: String? = null,
)

@Serializable
data class MealBuckets(
    val breakfast: List<FoodEntryResponse> = emptyList(),
    val lunch: List<FoodEntryResponse> = emptyList(),
    val dinner: List<FoodEntryResponse> = emptyList(),
    val snack: List<FoodEntryResponse> = emptyList()
)

@Serializable
data class DayLogResponse(
    val day: String,
    val calorieGoal: Double,
    val totalCalories: Double,
    val meals: MealBuckets
)

/** Totals in grams: protein, fats, carbs, fiber. */
data class DayMacroTotals(
    val protein: Double,
    val fats: Double,
    val carbs: Double,
    val fiber: Double
)

fun DayLogResponse.sumMacros(): DayMacroTotals {
    val all = meals.breakfast + meals.lunch + meals.dinner + meals.snack
    return all.fold(DayMacroTotals(0.0, 0.0, 0.0, 0.0)) { acc, e ->
        DayMacroTotals(
            acc.protein + e.protein,
            acc.fats + e.fats,
            acc.carbs + e.carbs,
            acc.fiber + e.fiber
        )
    }
}

@Serializable
data class FrequentFoodItem(val name: String, val count: Int)

@Serializable
data class FrequentFoodsResponse(val items: List<FrequentFoodItem>)
