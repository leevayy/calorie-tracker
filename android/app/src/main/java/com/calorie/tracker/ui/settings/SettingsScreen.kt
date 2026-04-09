package com.calorie.tracker.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.calorie.tracker.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel,
    onDarkModeChange: (Boolean) -> Unit,
    isDarkMode: Boolean,
    onLoggedOut: () -> Unit
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.load()
        viewModel.setDarkMode(isDarkMode)
    }

    LaunchedEffect(state.loggedOut) {
        if (state.loggedOut) onLoggedOut()
    }

    if (state.loading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        SettingsCard(stringResource(R.string.settings_language)) {
            DropdownField(
                label = stringResource(R.string.settings_language_label),
                value = state.preferredLanguage,
                options = listOf("en" to "English", "ru" to "Russian", "pl" to "Polish", "tt" to "Tatar", "kk" to "Kazakh"),
                onSelect = viewModel::setLanguage
            )
            Text(
                stringResource(R.string.settings_language_hint),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )
        }

        SettingsCard(stringResource(R.string.settings_goal)) {
            DropdownField(
                label = stringResource(R.string.settings_goal_label),
                value = state.nutritionGoal,
                options = listOf(
                    "maintain" to stringResource(R.string.goal_maintain),
                    "muscle_gain" to stringResource(R.string.goal_muscle_gain),
                    "fat_loss" to stringResource(R.string.goal_fat_loss),
                    "recomposition" to stringResource(R.string.goal_recomposition)
                ),
                onSelect = viewModel::setNutritionGoal
            )
        }

        SettingsCard(stringResource(R.string.settings_ai_model)) {
            DropdownField(
                label = stringResource(R.string.settings_ai_model_label),
                value = state.aiModelPreference,
                options = listOf(
                    "deepseek" to "DeepSeek",
                    "qwen3" to "Qwen 3",
                    "gptoss" to "GPT-OSS",
                    "alicegpt" to "Alice GPT"
                ),
                onSelect = viewModel::setAiModel
            )
        }

        SettingsCard(stringResource(R.string.settings_appearance)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(stringResource(R.string.settings_dark_mode))
                Switch(
                    checked = state.darkMode,
                    onCheckedChange = {
                        viewModel.setDarkMode(it)
                        onDarkModeChange(it)
                    }
                )
            }
        }

        SettingsCard(stringResource(R.string.settings_daily_goals)) {
            OutlinedTextField(
                value = state.dailyGoal,
                onValueChange = viewModel::setDailyGoal,
                label = { Text(stringResource(R.string.settings_calorie_goal)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Text(
                stringResource(R.string.settings_recommended_calories),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )
        }

        SettingsCard(stringResource(R.string.settings_profile)) {
            OutlinedTextField(
                value = state.weight,
                onValueChange = viewModel::setWeight,
                label = { Text(stringResource(R.string.settings_weight)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = state.height,
                onValueChange = viewModel::setHeight,
                label = { Text(stringResource(R.string.settings_height)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))

            state.saveError?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 8.dp))
            }

            if (state.saveSuccess) {
                Text("✓ Saved", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 8.dp))
            }

            Button(
                onClick = viewModel::save,
                enabled = !state.saving,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (state.saving) CircularProgressIndicator(
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp,
                    modifier = Modifier.height(20.dp)
                )
                else Text(stringResource(R.string.settings_save))
            }
        }

        SettingsCard(stringResource(R.string.settings_account)) {
            Button(
                onClick = viewModel::logout,
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
                Text(stringResource(R.string.settings_sign_out))
            }
        }

        SettingsCard(stringResource(R.string.settings_about)) {
            Text(stringResource(R.string.settings_version), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            Text(stringResource(R.string.settings_about_body), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

@Composable
private fun SettingsCard(title: String, content: @Composable () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, fontWeight = FontWeight.Medium, modifier = Modifier.padding(bottom = 12.dp))
            content()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DropdownField(
    label: String,
    value: String,
    options: List<Pair<String, String>>,
    onSelect: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val displayValue = options.firstOrNull { it.first == value }?.second ?: value

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = displayValue,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (key, display) ->
                DropdownMenuItem(
                    text = { Text(display) },
                    onClick = { onSelect(key); expanded = false }
                )
            }
        }
    }
}
