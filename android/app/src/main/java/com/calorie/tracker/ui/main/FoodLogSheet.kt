package com.calorie.tracker.ui.main

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.calorie.tracker.R
import com.calorie.tracker.data.model.FrequentFoodItem
import com.calorie.tracker.data.model.ParsedFoodSuggestion

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FoodLogSheet(
    chatInput: String,
    onChatInputChange: (String) -> Unit,
    onSend: () -> Unit,
    parseLoading: Boolean,
    parseError: String?,
    suggestions: List<ParsedFoodSuggestion>,
    onAccept: (Int) -> Unit,
    onReject: (Int) -> Unit,
    onClear: () -> Unit,
    targetMeal: String,
    onTargetMealChange: (String) -> Unit,
    frequentFoods: List<FrequentFoodItem>,
    addError: String?,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val meals = listOf("breakfast", "lunch", "dinner", "snack")
    val mealLabels = mapOf(
        "breakfast" to R.string.meal_breakfast,
        "lunch" to R.string.meal_lunch,
        "dinner" to R.string.meal_dinner,
        "snack" to R.string.meal_snack
    )

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .padding(horizontal = 16.dp)
                .padding(bottom = 24.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = chatInput,
                    onValueChange = onChatInputChange,
                    placeholder = { Text(stringResource(R.string.main_log_food_placeholder)) },
                    singleLine = true,
                    enabled = !parseLoading,
                    modifier = Modifier.weight(1f)
                )
                IconButton(
                    onClick = onSend,
                    enabled = chatInput.isNotBlank() && !parseLoading
                ) {
                    if (parseLoading) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    else Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
                }
            }

            parseError?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))
            }

            Spacer(Modifier.height(12.dp))

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.weight(1f, fill = false)
            ) {
                if (frequentFoods.isNotEmpty() && !parseLoading) {
                    item {
                        Text(
                            stringResource(R.string.main_recent_logged),
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(bottom = 4.dp)
                        )
                    }
                    frequentFoods.forEach { food ->
                        item(key = "freq-${food.name}") {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onChatInputChange(food.name) }
                                    .padding(vertical = 10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(food.name, fontWeight = FontWeight.Medium)
                                Text(
                                    "×${food.count}",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            HorizontalDivider()
                        }
                    }
                }

                if (suggestions.isNotEmpty()) {
                    item {
                        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(stringResource(R.string.main_recognized_foods), fontWeight = FontWeight.Medium)
                            TextButton(onClick = onClear) {
                                Text(stringResource(R.string.main_clear))
                            }
                        }
                    }

                    item {
                        var mealExpanded by remember { mutableStateOf(false) }
                        ExposedDropdownMenuBox(
                            expanded = mealExpanded,
                            onExpandedChange = { mealExpanded = it }
                        ) {
                            OutlinedTextField(
                                value = stringResource(mealLabels[targetMeal] ?: R.string.meal_breakfast),
                                onValueChange = {},
                                readOnly = true,
                                label = { Text(stringResource(R.string.main_add_to_meal)) },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(mealExpanded) },
                                modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
                            )
                            ExposedDropdownMenu(expanded = mealExpanded, onDismissRequest = { mealExpanded = false }) {
                                meals.forEach { m ->
                                    DropdownMenuItem(
                                        text = { Text(stringResource(mealLabels[m] ?: R.string.meal_breakfast)) },
                                        onClick = { onTargetMealChange(m); mealExpanded = false }
                                    )
                                }
                            }
                        }
                    }

                    itemsIndexed(suggestions) { index, food ->
                        FoodSuggestionCard(
                            food = food,
                            onAccept = { onAccept(index) },
                            onReject = { onReject(index) }
                        )
                    }

                    addError?.let { err ->
                        item {
                            Text(err, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
}
