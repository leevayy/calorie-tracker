package com.calorie.tracker.ui.main

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.calorie.tracker.R
import com.calorie.tracker.data.local.ReferenceFoodDb
import com.calorie.tracker.data.model.sumMacros
import com.calorie.tracker.ui.components.DayMacrosRow
import kotlin.math.roundToInt

@Composable
fun MainScreen(viewModel: MainViewModel, referenceFoodDb: ReferenceFoodDb? = null) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.referenceFoodDb = referenceFoodDb
        viewModel.loadProfile()
        viewModel.loadDay()
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { viewModel.setSheetOpen(true) }) {
                Icon(Icons.Default.Add, contentDescription = stringResource(R.string.main_log_food_placeholder))
            }
        }
    ) { padding ->
        if (state.dayLoading && state.dayLog == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                state.dayLog?.let { dayLog ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        val (p, f, c) = dayLog.sumMacros()
                        Column(
                            modifier = Modifier.weight(1f),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            CalorieRing(
                                consumed = dayLog.totalCalories.roundToInt(),
                                goal = dayLog.calorieGoal.roundToInt(),
                                label = stringResource(R.string.main_calories_today),
                                modifier = Modifier.fillMaxWidth()
                            )
                            DayMacrosRow(
                                modifier = Modifier.padding(top = 8.dp),
                                protein = p,
                                fats = f,
                                carbs = c
                            )
                        }

                        Card(
                            modifier = Modifier.weight(1f),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        stringResource(R.string.main_tip),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    IconButton(
                                        onClick = { viewModel.loadTip() },
                                        enabled = !state.tipLoading,
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.Refresh,
                                            contentDescription = stringResource(R.string.main_regenerate_tip),
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                                Spacer(Modifier.height(4.dp))
                                if (state.tipLoading) {
                                    CircularProgressIndicator(modifier = Modifier.size(20.dp).align(Alignment.CenterHorizontally), strokeWidth = 2.dp)
                                } else {
                                    Text(
                                        state.tip?.message ?: stringResource(R.string.state_empty_tip),
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                            }
                        }
                    }

                    MealCard(
                        title = stringResource(R.string.meal_breakfast),
                        foods = dayLog.meals.breakfast,
                        onDelete = viewModel::deleteEntry,
                        deleteEnabled = !state.deleteLoading
                    )
                    MealCard(
                        title = stringResource(R.string.meal_lunch),
                        foods = dayLog.meals.lunch,
                        onDelete = viewModel::deleteEntry,
                        deleteEnabled = !state.deleteLoading
                    )
                    MealCard(
                        title = stringResource(R.string.meal_dinner),
                        foods = dayLog.meals.dinner,
                        onDelete = viewModel::deleteEntry,
                        deleteEnabled = !state.deleteLoading
                    )
                    MealCard(
                        title = stringResource(R.string.meal_snack),
                        foods = dayLog.meals.snack,
                        onDelete = viewModel::deleteEntry,
                        deleteEnabled = !state.deleteLoading
                    )
                } ?: run {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text(
                            stringResource(R.string.state_empty_day),
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Spacer(Modifier.height(72.dp))
            }
        }
    }

    if (state.sheetOpen) {
        FoodLogSheet(
            chatInput = state.chatInput,
            onChatInputChange = viewModel::setChatInput,
            onSend = viewModel::parseFood,
            parseLoading = state.parseLoading,
            parseError = state.parseError,
            suggestions = state.suggestions,
            onAccept = viewModel::acceptSuggestion,
            onReject = viewModel::rejectSuggestion,
            onClear = viewModel::clearSuggestions,
            targetMeal = state.targetMeal,
            onTargetMealChange = viewModel::setTargetMeal,
            frequentFoods = state.frequentFoods,
            addError = state.addError,
            onDismiss = { viewModel.setSheetOpen(false) }
        )
    }
}
