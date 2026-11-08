package com.sapryx.transit.stops

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ListItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.sapryx.transit.R
import com.sapryx.transit.routes.routeTitle
import com.sapryx.transit.ui.LoadableContent

@Composable
fun StopsScreen(onStopClick: (Stop) -> Unit, viewModel: StopsViewModel = hiltViewModel()) {
    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = viewModel.query,
            onValueChange = viewModel::search,
            label = { Text(stringResource(R.string.stops_search)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(16.dp).testTag("stop-search"),
        )
        LoadableContent(viewModel.stops) { stops ->
            if (stops.isEmpty()) {
                Text(stringResource(R.string.stops_empty), Modifier.padding(16.dp))
            }
            LazyColumn {
                items(stops, key = { it.id }) { stop ->
                    ListItem(
                        headlineContent = { Text(stop.name) },
                        supportingContent = { Text(stop.routes.map { stringResource(it.mode.routeTitle(), it.number) }.joinToString()) },
                        modifier = Modifier.clickable { onStopClick(stop) },
                    )
                }
            }
        }
    }
}
