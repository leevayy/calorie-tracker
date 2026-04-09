package com.calorie.tracker.ui.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.calorie.tracker.data.api.ApiClient
import com.calorie.tracker.data.model.CreateFoodEntryBody
import com.calorie.tracker.data.model.DailyTipResponse
import com.calorie.tracker.data.model.DayLogResponse
import com.calorie.tracker.data.model.FrequentFoodItem
import com.calorie.tracker.data.model.ParseFoodRequest
import com.calorie.tracker.data.model.ParsedFoodSuggestion
import com.calorie.tracker.util.buildDailyTipRequest
import com.calorie.tracker.util.defaultMealTypeForLocalTime
import com.calorie.tracker.util.localIsoDate
import com.calorie.tracker.util.weekRangeEndingOn
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MainUiState(
    val today: String = localIsoDate(),
    val dayLog: DayLogResponse? = null,
    val dayLoading: Boolean = false,
    val tip: DailyTipResponse? = null,
    val tipLoading: Boolean = false,
    val chatInput: String = "",
    val suggestions: List<ParsedFoodSuggestion> = emptyList(),
    val parseLoading: Boolean = false,
    val parseError: String? = null,
    val targetMeal: String = defaultMealTypeForLocalTime(),
    val frequentFoods: List<FrequentFoodItem> = emptyList(),
    val sheetOpen: Boolean = false,
    val preferredLanguage: String = "en",
    val deleteLoading: Boolean = false,
    val addError: String? = null
)

class MainViewModel : ViewModel() {
    private val _state = MutableStateFlow(MainUiState())
    val state = _state.asStateFlow()

    fun loadDay() {
        val day = _state.value.today
        _state.update { it.copy(dayLoading = true) }
        viewModelScope.launch {
            try {
                val res = ApiClient.foodLog.getDayLog(day)
                if (res.isSuccessful) {
                    _state.update { it.copy(dayLog = res.body(), dayLoading = false) }
                    loadTip()
                    loadFrequentFoods()
                } else {
                    _state.update { it.copy(dayLoading = false) }
                }
            } catch (_: Exception) {
                _state.update { it.copy(dayLoading = false) }
            }
        }
    }

    fun loadProfile() {
        viewModelScope.launch {
            try {
                val res = ApiClient.profile.getProfile()
                if (res.isSuccessful) {
                    res.body()?.let { p ->
                        _state.update { it.copy(preferredLanguage = p.preferredLanguage) }
                    }
                }
            } catch (_: Exception) {}
        }
    }

    fun loadTip() {
        val dayLog = _state.value.dayLog ?: return
        _state.update { it.copy(tipLoading = true) }
        viewModelScope.launch {
            try {
                val req = buildDailyTipRequest(dayLog, _state.value.today, _state.value.preferredLanguage)
                val res = ApiClient.tips.getDailyTip(req)
                if (res.isSuccessful) {
                    _state.update { it.copy(tip = res.body(), tipLoading = false) }
                } else {
                    _state.update { it.copy(tipLoading = false) }
                }
            } catch (_: Exception) {
                _state.update { it.copy(tipLoading = false) }
            }
        }
    }

    private fun loadFrequentFoods() {
        val (from, to) = weekRangeEndingOn(_state.value.today)
        viewModelScope.launch {
            try {
                val res = ApiClient.foodLog.getFrequentFoods(from, to, 3)
                if (res.isSuccessful) {
                    _state.update { it.copy(frequentFoods = res.body()?.items ?: emptyList()) }
                }
            } catch (_: Exception) {}
        }
    }

    fun setChatInput(v: String) { _state.update { it.copy(chatInput = v) } }
    fun setTargetMeal(v: String) { _state.update { it.copy(targetMeal = v) } }
    fun setSheetOpen(v: Boolean) { _state.update { it.copy(sheetOpen = v) } }

    fun parseFood() {
        val text = _state.value.chatInput.trim()
        if (text.isEmpty()) return
        _state.update { it.copy(parseLoading = true, parseError = null) }
        viewModelScope.launch {
            try {
                val res = ApiClient.aiFood.parseFood(
                    ParseFoodRequest(text, _state.value.preferredLanguage)
                )
                if (res.isSuccessful) {
                    val items = res.body()?.suggestions ?: emptyList()
                    _state.update {
                        it.copy(
                            suggestions = items + it.suggestions,
                            parseLoading = false,
                            chatInput = "",
                            sheetOpen = true
                        )
                    }
                } else {
                    _state.update { it.copy(parseLoading = false, parseError = "Could not parse food") }
                }
            } catch (_: Exception) {
                _state.update { it.copy(parseLoading = false, parseError = "Network error") }
            }
        }
    }

    fun acceptSuggestion(index: Int) {
        val suggestion = _state.value.suggestions.getOrNull(index) ?: return
        val day = _state.value.today
        _state.update { it.copy(addError = null) }
        viewModelScope.launch {
            try {
                val res = ApiClient.foodLog.createEntry(
                    day,
                    CreateFoodEntryBody(
                        mealType = _state.value.targetMeal,
                        name = suggestion.name,
                        calories = suggestion.calories,
                        protein = suggestion.protein,
                        carbs = suggestion.carbs,
                        fats = suggestion.fats,
                        portion = suggestion.portion
                    )
                )
                if (res.isSuccessful) {
                    _state.update { it.copy(suggestions = it.suggestions.filterIndexed { i, _ -> i != index }) }
                    loadDay()
                } else {
                    _state.update { it.copy(addError = "Failed to add") }
                }
            } catch (_: Exception) {
                _state.update { it.copy(addError = "Network error") }
            }
        }
    }

    fun rejectSuggestion(index: Int) {
        _state.update { it.copy(suggestions = it.suggestions.filterIndexed { i, _ -> i != index }) }
    }

    fun clearSuggestions() {
        _state.update { it.copy(suggestions = emptyList()) }
    }

    fun deleteEntry(entryId: String) {
        _state.update { it.copy(deleteLoading = true) }
        viewModelScope.launch {
            try {
                val res = ApiClient.foodLog.deleteEntry(entryId)
                if (res.isSuccessful || res.code() == 204) {
                    loadDay()
                }
            } catch (_: Exception) {}
            _state.update { it.copy(deleteLoading = false) }
        }
    }
}
