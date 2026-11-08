package com.sapryx.transit.routes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.sapryx.transit.R
import com.sapryx.transit.ui.LoadableContent

private fun TransportMode.groupTitle() = when (this) {
    TransportMode.Bus -> R.string.mode_bus
    TransportMode.Trolleybus -> R.string.mode_trolleybus
}

@Composable
fun RoutesScreen(onRouteClick: (Int) -> Unit, viewModel: RoutesViewModel = hiltViewModel()) {
    var filter by rememberSaveable { mutableStateOf("") }
    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = filter,
            onValueChange = { filter = it },
            label = { Text(stringResource(R.string.routes_filter)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(16.dp).testTag("route-filter"),
        )
        LoadableContent(viewModel.routes) { routes ->
            val groups = routes.filter { it.number.startsWith(filter.trim(), ignoreCase = true) }.groupBy { it.mode }.toSortedMap()
            if (groups.isEmpty()) {
                Text(stringResource(R.string.routes_empty), Modifier.padding(16.dp))
            }
            LazyColumn {
                groups.forEach { (mode, group) ->
                    item(key = mode.name) {
                        Text(
                            stringResource(mode.groupTitle()),
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        )
                    }
                    items(group, key = { it.id }) { route ->
                        ListItem(
                            headlineContent = { Text(route.number, style = MaterialTheme.typography.titleLarge) },
                            supportingContent = {
                                Column { route.directions.forEach { Text(it.name) } }
                            },
                            modifier = Modifier.clickable { onRouteClick(route.id) },
                        )
                    }
                }
            }
        }
    }
}
