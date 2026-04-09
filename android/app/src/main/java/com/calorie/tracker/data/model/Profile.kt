package com.calorie.tracker.data.model

import kotlinx.serialization.Serializable

@Serializable
data class UserProfileResponse(
    val user: UserSummary,
    val dailyCalorieGoal: Double,
    val weightKg: Double? = null,
    val heightCm: Double? = null,
    val preferredLanguage: String = "en",
    val nutritionGoal: String = "maintain",
    val aiModelPreference: String = "qwen3",
    val updatedAt: String
)

@Serializable
data class UpdateProfileRequest(
    val dailyCalorieGoal: Double? = null,
    val weightKg: Double? = null,
    val heightCm: Double? = null,
    val preferredLanguage: String? = null,
    val nutritionGoal: String? = null,
    val aiModelPreference: String? = null
)
