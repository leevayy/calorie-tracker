package com.calorie.tracker.data.model

import kotlinx.serialization.Serializable

@Serializable
data class DailyHistoryPoint(
    val date: String,
    val calories: Double,
    val goal: Double
)

@Serializable
data class HistoryRangeResponse(
    val from: String,
    val to: String,
    val days: List<DailyHistoryPoint>,
    val weeklyAverageCalories: Double? = null
)
