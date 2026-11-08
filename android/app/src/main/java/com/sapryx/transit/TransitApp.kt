package com.sapryx.transit

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.sapryx.transit.navigation.Tab
import com.sapryx.transit.routes.RouteScreen
import com.sapryx.transit.routes.RouteViewModel
import com.sapryx.transit.routes.RoutesScreen

private const val STOP_ID = "stopId"

@Composable
private fun Placeholder(text: String, tag: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text, Modifier.testTag(tag))
    }
}

@Composable
fun TransitApp() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    MaterialTheme {
        Scaffold(
            bottomBar = {
                NavigationBar {
                    Tab.entries.forEach { tab ->
                        val title = stringResource(tab.title)
                        NavigationBarItem(
                            selected = backStackEntry?.destination?.route == tab.name,
                            onClick = {
                                navController.navigate(tab.name) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(tab.icon, contentDescription = null) },
                            label = { Text(title) },
                        )
                    }
                }
            },
        ) { padding ->
            NavHost(navController, startDestination = Tab.Routes.name, modifier = Modifier.padding(padding)) {
                composable(Tab.Routes.name) {
                    RoutesScreen(onRouteClick = { navController.navigate("route/$it") })
                }
                composable("route/{${RouteViewModel.ROUTE_ID}}", listOf(navArgument(RouteViewModel.ROUTE_ID) { type = NavType.IntType })) {
                    RouteScreen(onStopClick = { navController.navigate("stop/$it") })
                }
                composable("stop/{$STOP_ID}", listOf(navArgument(STOP_ID) { type = NavType.IntType })) { entry ->
                    Placeholder(stringResource(Tab.Stops.title), "stop:${entry.arguments?.getInt(STOP_ID)}")
                }
                (Tab.entries - Tab.Routes).forEach { tab ->
                    composable(tab.name) { Placeholder(stringResource(tab.title), "placeholder") }
                }
            }
        }
    }
}
