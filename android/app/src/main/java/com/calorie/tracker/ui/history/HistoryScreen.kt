package com.calorie.tracker.ui.history

import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.calorie.tracker.R
import com.calorie.tracker.ui.theme.Sky500
import com.calorie.tracker.ui.theme.Slate400
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

@Composable
fun HistoryScreen(viewModel: HistoryViewModel) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) { viewModel.load() }

    if (state.loading && state.days.isEmpty()) {
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
        if (state.days.isEmpty()) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                Text(
                    stringResource(R.string.state_empty_history),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            val weeklyGoal = state.days.firstOrNull()?.goal ?: 0.0
            val difference = state.weeklyAverage - weeklyGoal
            val displayAvg = state.weeklyAverage.roundToInt()
            val displayDiff = abs(difference).roundToInt()

            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        stringResource(R.string.history_weekly_summary),
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                stringResource(R.string.history_average),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text("$displayAvg", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
                            Text(
                                stringResource(R.string.history_cal_per_day),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                stringResource(R.string.history_vs_goal),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                "$displayDiff",
                                style = MaterialTheme.typography.headlineSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = if (difference > 0) MaterialTheme.colorScheme.error
                                else MaterialTheme.colorScheme.primary
                            )
                            Text(
                                if (difference > 0) stringResource(R.string.history_over)
                                else stringResource(R.string.history_under),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    Spacer(Modifier.height(16.dp))
                    SimpleLineChart(state.days.map { it.calories.toFloat() to it.goal.toFloat() })
                }
            }

            Text(
                stringResource(R.string.history_daily_breakdown),
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(top = 4.dp)
            )

            state.days.reversed().forEach { day ->
                val date = LocalDate.parse(day.date)
                val dayName = date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault())
                val diff = (day.calories - day.goal).roundToInt()
                val progress = if (day.goal > 0) (day.calories / day.goal).toFloat().coerceIn(0f, 1f) else 0f

                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(dayName)
                            Text(
                                "${day.calories.roundToInt()} / ${day.goal.roundToInt()} cal",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                "${if (diff > 0) "+" else ""}$diff cal",
                                style = MaterialTheme.typography.bodySmall,
                                color = if (diff > 0) MaterialTheme.colorScheme.error
                                else MaterialTheme.colorScheme.primary
                            )
                            Spacer(Modifier.height(4.dp))
                            LinearProgressIndicator(
                                progress = { progress },
                                modifier = Modifier.height(6.dp),
                                trackColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SimpleLineChart(data: List<Pair<Float, Float>>) {
    if (data.isEmpty()) return
    val maxVal = data.maxOf { maxOf(it.first, it.second) }.coerceAtLeast(1f)

    Canvas(modifier = Modifier.fillMaxWidth().height(160.dp)) {
        val w = size.width
        val h = size.height
        val step = if (data.size > 1) w / (data.size - 1) else w

        val goalPath = PathEffect.dashPathEffect(floatArrayOf(10f, 10f))
        for (i in 0 until data.size - 1) {
            val x1 = i * step; val x2 = (i + 1) * step
            val y1 = h - (data[i].second / maxVal) * h
            val y2 = h - (data[i + 1].second / maxVal) * h
            drawLine(Slate400, Offset(x1, y1), Offset(x2, y2), strokeWidth = 2f, pathEffect = goalPath)
        }

        for (i in 0 until data.size - 1) {
            val x1 = i * step; val x2 = (i + 1) * step
            val y1 = h - (data[i].first / maxVal) * h
            val y2 = h - (data[i + 1].first / maxVal) * h
            drawLine(Sky500, Offset(x1, y1), Offset(x2, y2), strokeWidth = 4f, cap = StrokeCap.Round)
        }

        data.forEachIndexed { i, (cal, _) ->
            val x = i * step
            val y = h - (cal / maxVal) * h
            drawCircle(Sky500, radius = 6f, center = Offset(x, y))
        }
    }
}
