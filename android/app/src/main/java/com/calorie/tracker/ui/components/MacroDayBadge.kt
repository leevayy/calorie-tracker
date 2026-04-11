package com.calorie.tracker.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.calorie.tracker.R
import kotlin.math.abs
import kotlin.math.round

@Composable
fun DayMacrosRow(modifier: Modifier = Modifier, protein: Double, fats: Double, carbs: Double) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        MacroDayBadge(stringResource(R.string.macro_protein_letter), protein)
        MacroDayBadge(stringResource(R.string.macro_fats_letter), fats)
        MacroDayBadge(stringResource(R.string.macro_carbs_letter), carbs)
    }
}

@Composable
fun MacroDayBadge(letter: String, grams: Double) {
    Surface(
        shape = RoundedCornerShape(percent = 50),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f)
    ) {
        Text(
            "$letter ${formatMacroGrams(grams)}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

fun formatMacroGrams(n: Double): String {
    val r = round(n * 10.0) / 10.0
    return if (abs(r - r.toInt()) < 1e-6) r.toInt().toString() else String.format("%.1f", r)
}
