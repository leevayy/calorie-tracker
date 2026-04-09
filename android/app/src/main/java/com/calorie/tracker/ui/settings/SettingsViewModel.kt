package com.calorie.tracker.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.calorie.tracker.data.api.ApiClient
import com.calorie.tracker.data.local.SessionStore
import com.calorie.tracker.data.model.UpdateProfileRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SettingsUiState(
    val loading: Boolean = false,
    val saving: Boolean = false,
    val dailyGoal: String = "2000",
    val weight: String = "",
    val height: String = "",
    val preferredLanguage: String = "en",
    val nutritionGoal: String = "maintain",
    val aiModelPreference: String = "qwen3",
    val darkMode: Boolean = false,
    val saveError: String? = null,
    val saveSuccess: Boolean = false,
    val loggedOut: Boolean = false
)

class SettingsViewModel(private val sessionStore: SessionStore) : ViewModel() {
    private val _state = MutableStateFlow(SettingsUiState())
    val state = _state.asStateFlow()

    fun load() {
        _state.update { it.copy(loading = true) }
        viewModelScope.launch {
            try {
                val res = ApiClient.profile.getProfile()
                if (res.isSuccessful && res.body() != null) {
                    val p = res.body()!!
                    _state.update {
                        it.copy(
                            loading = false,
                            dailyGoal = p.dailyCalorieGoal.toInt().toString(),
                            weight = p.weightKg?.toString() ?: "",
                            height = p.heightCm?.toString() ?: "",
                            preferredLanguage = p.preferredLanguage,
                            nutritionGoal = p.nutritionGoal,
                            aiModelPreference = p.aiModelPreference
                        )
                    }
                } else {
                    _state.update { it.copy(loading = false) }
                }
            } catch (_: Exception) {
                _state.update { it.copy(loading = false) }
            }
        }
    }

    fun setDailyGoal(v: String) { _state.update { it.copy(dailyGoal = v, saveSuccess = false) } }
    fun setWeight(v: String) { _state.update { it.copy(weight = v, saveSuccess = false) } }
    fun setHeight(v: String) { _state.update { it.copy(height = v, saveSuccess = false) } }
    fun setLanguage(v: String) { _state.update { it.copy(preferredLanguage = v, saveSuccess = false) } }
    fun setNutritionGoal(v: String) { _state.update { it.copy(nutritionGoal = v, saveSuccess = false) } }
    fun setAiModel(v: String) { _state.update { it.copy(aiModelPreference = v, saveSuccess = false) } }
    fun setDarkMode(v: Boolean) { _state.update { it.copy(darkMode = v) } }

    fun save() {
        val s = _state.value
        _state.update { it.copy(saving = true, saveError = null, saveSuccess = false) }
        viewModelScope.launch {
            try {
                val w = s.weight.toDoubleOrNull()
                val h = s.height.toDoubleOrNull()
                val goal = s.dailyGoal.toDoubleOrNull() ?: 2000.0
                val res = ApiClient.profile.updateProfile(
                    UpdateProfileRequest(
                        dailyCalorieGoal = goal,
                        weightKg = if (w != null && w > 0) w else null,
                        heightCm = if (h != null && h > 0) h else null,
                        preferredLanguage = s.preferredLanguage,
                        nutritionGoal = s.nutritionGoal,
                        aiModelPreference = s.aiModelPreference
                    )
                )
                if (res.isSuccessful) {
                    _state.update { it.copy(saving = false, saveSuccess = true) }
                } else {
                    _state.update { it.copy(saving = false, saveError = "Failed to save") }
                }
            } catch (_: Exception) {
                _state.update { it.copy(saving = false, saveError = "Network error") }
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            sessionStore.clear()
            _state.update { it.copy(loggedOut = true) }
        }
    }
}
