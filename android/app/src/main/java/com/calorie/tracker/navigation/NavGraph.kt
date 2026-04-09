package com.calorie.tracker.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Timeline
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.calorie.tracker.R
import com.calorie.tracker.data.local.SessionStore
import com.calorie.tracker.ui.auth.AuthScreen
import com.calorie.tracker.ui.auth.AuthViewModel
import com.calorie.tracker.ui.history.HistoryScreen
import com.calorie.tracker.ui.history.HistoryViewModel
import com.calorie.tracker.ui.main.MainScreen
import com.calorie.tracker.ui.main.MainViewModel
import com.calorie.tracker.ui.settings.SettingsScreen
import com.calorie.tracker.ui.settings.SettingsViewModel

object Routes {
    const val AUTH = "auth"
    const val HOME = "home"
    const val HISTORY = "history"
    const val SETTINGS = "settings"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppNavGraph(
    sessionStore: SessionStore,
    startRoute: String,
    isDarkMode: Boolean,
    onDarkModeChange: (Boolean) -> Unit
) {
    val navController = rememberNavController()
    val navEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navEntry?.destination?.route
    val showBottomBar = currentRoute in listOf(Routes.HOME, Routes.HISTORY, Routes.SETTINGS)

    val titles = mapOf(
        Routes.HOME to R.string.app_name,
        Routes.HISTORY to R.string.history_title,
        Routes.SETTINGS to R.string.settings_title
    )

    Scaffold(
        topBar = {
            if (showBottomBar) {
                TopAppBar(
                    title = {
                        Text(stringResource(titles[currentRoute] ?: R.string.app_name))
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.background
                    )
                )
            }
        },
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.Home, contentDescription = null) },
                        label = { Text(stringResource(R.string.nav_home)) },
                        selected = navEntry?.destination?.hierarchy?.any { it.route == Routes.HOME } == true,
                        onClick = {
                            navController.navigate(Routes.HOME) {
                                popUpTo(Routes.HOME) { inclusive = true }
                                launchSingleTop = true
                            }
                        }
                    )
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.Timeline, contentDescription = null) },
                        label = { Text(stringResource(R.string.nav_history)) },
                        selected = navEntry?.destination?.hierarchy?.any { it.route == Routes.HISTORY } == true,
                        onClick = {
                            navController.navigate(Routes.HISTORY) {
                                popUpTo(Routes.HOME)
                                launchSingleTop = true
                            }
                        }
                    )
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.Settings, contentDescription = null) },
                        label = { Text(stringResource(R.string.nav_settings)) },
                        selected = navEntry?.destination?.hierarchy?.any { it.route == Routes.SETTINGS } == true,
                        onClick = {
                            navController.navigate(Routes.SETTINGS) {
                                popUpTo(Routes.HOME)
                                launchSingleTop = true
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = startRoute,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Routes.AUTH) {
                val vm = viewModel<AuthViewModel> { AuthViewModel(sessionStore) }
                AuthScreen(viewModel = vm) {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.AUTH) { inclusive = true }
                    }
                }
            }
            composable(Routes.HOME) {
                val vm = viewModel<MainViewModel>()
                MainScreen(viewModel = vm)
            }
            composable(Routes.HISTORY) {
                val vm = viewModel<HistoryViewModel>()
                HistoryScreen(viewModel = vm)
            }
            composable(Routes.SETTINGS) {
                val vm = viewModel<SettingsViewModel> { SettingsViewModel(sessionStore) }
                SettingsScreen(
                    viewModel = vm,
                    onDarkModeChange = onDarkModeChange,
                    isDarkMode = isDarkMode,
                    onLoggedOut = {
                        navController.navigate(Routes.AUTH) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }
        }
    }
}
