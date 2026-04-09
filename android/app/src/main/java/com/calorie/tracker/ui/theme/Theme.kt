package com.calorie.tracker.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary = Sky500,
    onPrimary = Color.White,
    primaryContainer = Sky400,
    secondary = Slate400,
    background = Color(0xFFFAFAFA),
    surface = Color.White,
    surfaceVariant = Slate100,
    onBackground = Slate900,
    onSurface = Slate900,
    outline = Slate200,
    error = Red500,
    onError = Color.White
)

private val DarkColorScheme = darkColorScheme(
    primary = Sky400,
    onPrimary = Slate900,
    primaryContainer = Sky600,
    secondary = Slate400,
    background = Slate900,
    surface = Slate800,
    surfaceVariant = Slate700,
    onBackground = Slate100,
    onSurface = Slate100,
    outline = Slate700,
    error = Red400,
    onError = Slate900
)

@Composable
fun CalorieTrackerTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }
    MaterialTheme(colorScheme = colorScheme, content = content)
}
