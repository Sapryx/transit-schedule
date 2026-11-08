package com.sapryx.transit.stops

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.sapryx.transit.routes.routeTitle
import com.sapryx.transit.ui.LoadableContent

@Composable
fun StopScreen(onRouteClick: (Int) -> Unit, viewModel: StopViewModel = hiltViewModel()) {
    LoadableContent(viewModel.stop) { stop ->
        Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(stop.name, style = MaterialTheme.typography.titleLarge, modifier = Modifier.testTag("stop-name"))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                stop.routes.forEach { route ->
                    SuggestionChip(
                        onClick = { onRouteClick(route.id) },
                        label = { Text(stringResource(route.mode.routeTitle(), route.number)) },
                        modifier = Modifier.testTag("route-chip"),
                    )
                }
            }
        }
    }
}
