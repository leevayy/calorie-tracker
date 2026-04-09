package com.calorie.tracker.ui.reference

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.calorie.tracker.data.local.ReferenceFoodDb
import com.calorie.tracker.data.local.ReferenceFoodEntity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ReferenceFoodsUiState(
    val foods: List<ReferenceFoodEntity> = emptyList(),
    val name: String = "",
    val calories: String = "",
    val protein: String = "",
    val carbs: String = "",
    val fats: String = "",
    val portion: String = "100g"
)

class ReferenceFoodsViewModel(private val db: ReferenceFoodDb) : ViewModel() {
    private val _state = MutableStateFlow(ReferenceFoodsUiState())
    val state = _state.asStateFlow()

    init {
        viewModelScope.launch {
            db.dao().getAll().collect { list ->
                _state.update { it.copy(foods = list) }
            }
        }
    }

    fun setName(v: String) { _state.update { it.copy(name = v) } }
    fun setCalories(v: String) { _state.update { it.copy(calories = v) } }
    fun setProtein(v: String) { _state.update { it.copy(protein = v) } }
    fun setCarbs(v: String) { _state.update { it.copy(carbs = v) } }
    fun setFats(v: String) { _state.update { it.copy(fats = v) } }
    fun setPortion(v: String) { _state.update { it.copy(portion = v) } }

    fun add() {
        val s = _state.value
        if (s.name.isBlank()) return
        val cal = s.calories.toDoubleOrNull() ?: return
        val p = s.protein.toDoubleOrNull() ?: return
        val c = s.carbs.toDoubleOrNull() ?: return
        val f = s.fats.toDoubleOrNull() ?: return
        val portion = s.portion.ifBlank { "100g" }

        viewModelScope.launch {
            db.dao().insert(
                ReferenceFoodEntity(
                    name = s.name.trim(),
                    calories = cal,
                    protein = p,
                    carbs = c,
                    fats = f,
                    portion = portion
                )
            )
            _state.update {
                it.copy(name = "", calories = "", protein = "", carbs = "", fats = "", portion = "100g")
            }
        }
    }

    fun remove(food: ReferenceFoodEntity) {
        viewModelScope.launch { db.dao().delete(food) }
    }
}
