package com.sapryx.transit.routes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.sapryx.transit.R
import com.sapryx.transit.ui.LoadableContent

private fun TransportMode.routeTitle() = when (this) {
    TransportMode.Bus -> R.string.route_title_bus
    TransportMode.Trolleybus -> R.string.route_title_trolleybus
}

@Composable
fun RouteScreen(onStopClick: (Int) -> Unit, viewModel: RouteViewModel = hiltViewModel()) {
    LoadableContent(viewModel.route) { route ->
        var selected by rememberSaveable { mutableIntStateOf(0) }
        Column(Modifier.fillMaxSize()) {
            Text(
                stringResource(route.mode.routeTitle(), route.number),
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.padding(16.dp),
            )
            PrimaryScrollableTabRow(selectedTabIndex = selected) {
                route.directions.forEachIndexed { index, direction ->
                    Tab(selected = index == selected, onClick = { selected = index }, text = { Text(direction.name) })
                }
            }
            LazyColumn {
                items(route.directions[selected].stops, key = { it.platformId }) { stop ->
                    ListItem(
                        headlineContent = { Text(stop.name) },
                        modifier = Modifier.clickable { onStopClick(stop.stopId) }.testTag("stop"),
                    )
                }
            }
        }
    }
}
