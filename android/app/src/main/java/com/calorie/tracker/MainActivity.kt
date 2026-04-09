package com.calorie.tracker

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.lifecycleScope
import com.calorie.tracker.navigation.AppNavGraph
import com.calorie.tracker.navigation.Routes
import com.calorie.tracker.ui.theme.CalorieTrackerTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as App
        var startRoute = Routes.AUTH

        lifecycleScope.launch {
            val restored = app.sessionStore.restore()
            if (restored) startRoute = Routes.HOME

            setContent {
                var darkMode by remember { mutableStateOf(false) }
                CalorieTrackerTheme(darkTheme = darkMode) {
                    AppNavGraph(
                        sessionStore = app.sessionStore,
                        startRoute = startRoute,
                        isDarkMode = darkMode,
                        onDarkModeChange = { darkMode = it }
                    )
                }
            }
        }
    }
}
