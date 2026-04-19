package com.calorie.tracker.data.model

import kotlinx.serialization.Serializable

@Serializable
data class ParseFoodRequest(
    val text: String,
    val preferredLanguage: String
)

@Serializable
data class ParsedFoodSuggestion(
    val name: String,
    val calories: Double,
    val protein: Double,
    val carbs: Double,
    val fats: Double,
    val portion: String,
    val description: String? = null,
    val mealSlug: String? = null,
)

@Serializable
data class ParseFoodResponse(
    val suggestions: List<ParsedFoodSuggestion>
)
