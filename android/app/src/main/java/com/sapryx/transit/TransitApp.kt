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
import androidx.compose.runtime.remember
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
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.sapryx.transit.journeys.JourneyEnd
import com.sapryx.transit.journeys.JourneyScreen
import com.sapryx.transit.journeys.JourneyViewModel
import com.sapryx.transit.navigation.Tab
import com.sapryx.transit.routes.RouteScreen
import com.sapryx.transit.routes.RouteViewModel
import com.sapryx.transit.routes.RoutesScreen
import com.sapryx.transit.stops.StopScreen
import com.sapryx.transit.stops.StopViewModel
import com.sapryx.transit.stops.StopsScreen

@Composable
private fun Placeholder(text: String, tag: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text, Modifier.testTag(tag))
    }
}

private const val JOURNEY_END = "end"

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
                composable(Tab.Stops.name) {
                    StopsScreen(onStopClick = { navController.navigate("stop/${it.id}") })
                }
                composable("stop/{${StopViewModel.STOP_ID}}", listOf(navArgument(StopViewModel.STOP_ID) { type = NavType.IntType })) {
                    StopScreen(onRouteClick = { navController.navigate("route/$it") })
                }
                composable(Tab.Journey.name) {
                    JourneyScreen(
                        onPickStop = { navController.navigate("pick-stop/${it.name}") },
                        onRouteClick = { navController.navigate("route/$it") },
                        onStopClick = { navController.navigate("stop/$it") },
                    )
                }
                composable("pick-stop/{$JOURNEY_END}") { entry ->
                    val journeyEntry = remember(entry) { navController.getBackStackEntry(Tab.Journey.name) }
                    val journeyViewModel: JourneyViewModel = hiltViewModel(journeyEntry)
                    val end = JourneyEnd.valueOf(checkNotNull(entry.arguments?.getString(JOURNEY_END)))
                    StopsScreen(onStopClick = {
                        journeyViewModel.choose(end, it)
                        navController.popBackStack()
                    })
                }
                (Tab.entries - Tab.Routes - Tab.Stops - Tab.Journey).forEach { tab ->
                    composable(tab.name) { Placeholder(stringResource(tab.title), "placeholder") }
                }
            }
        }
    }
}
