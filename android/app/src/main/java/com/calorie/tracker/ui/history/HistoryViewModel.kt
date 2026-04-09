package com.calorie.tracker.ui.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.calorie.tracker.data.api.ApiClient
import com.calorie.tracker.data.model.DailyHistoryPoint
import com.calorie.tracker.util.localIsoDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate

data class HistoryUiState(
    val loading: Boolean = false,
    val days: List<DailyHistoryPoint> = emptyList(),
    val weeklyAverage: Double = 0.0,
    val error: String? = null
)

class HistoryViewModel : ViewModel() {
    private val _state = MutableStateFlow(HistoryUiState())
    val state = _state.asStateFlow()

    fun load() {
        val to = localIsoDate()
        val from = localIsoDate(LocalDate.now().minusDays(6))
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val res = ApiClient.history.getHistory(from, to)
                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    val avg = body.weeklyAverageCalories
                        ?: if (body.days.isNotEmpty()) body.days.sumOf { it.calories } / body.days.size
                        else 0.0
                    _state.update { it.copy(loading = false, days = body.days, weeklyAverage = avg) }
                } else {
                    _state.update { it.copy(loading = false, error = "Failed to load history") }
                }
            } catch (_: Exception) {
                _state.update { it.copy(loading = false, error = "Network error") }
            }
        }
    }
}
