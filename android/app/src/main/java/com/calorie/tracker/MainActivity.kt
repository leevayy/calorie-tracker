package com.calorie.tracker

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.lifecycleScope
import com.calorie.tracker.data.api.ApiClient
import com.calorie.tracker.data.api.AuthEvent
import com.calorie.tracker.navigation.AppNavGraph
import com.calorie.tracker.navigation.Routes
import com.calorie.tracker.ui.theme.CalorieTrackerTheme
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val forceLogout = MutableSharedFlow<Unit>(extraBufferCapacity = 1)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val app = application as App
        app.sessionStore.setupRefreshCallback()

        lifecycleScope.launch {
            ApiClient.authEvents.collect { event ->
                if (event == AuthEvent.SESSION_EXPIRED) {
                    app.sessionStore.clear()
                    forceLogout.tryEmit(Unit)
                }
            }
        }

        var startRoute = Routes.AUTH

        lifecycleScope.launch {
            val restored = app.sessionStore.restore()
            if (restored) startRoute = Routes.HOME

            setContent {
                var darkMode by remember { mutableStateOf(false) }
                var logoutTrigger by remember { mutableStateOf(0) }

                LaunchedEffect(Unit) {
                    forceLogout.collect { logoutTrigger++ }
                }

                val effectiveStart = if (logoutTrigger > 0) Routes.AUTH else startRoute

                CalorieTrackerTheme(darkTheme = darkMode) {
                    AppNavGraph(
                        sessionStore = app.sessionStore,
                        referenceFoodDb = app.referenceFoodDb,
                        startRoute = effectiveStart,
                        isDarkMode = darkMode,
                        onDarkModeChange = { darkMode = it },
                        key = logoutTrigger
                    )
                }
            }
        }
    }
}
