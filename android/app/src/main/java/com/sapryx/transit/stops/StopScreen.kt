package com.sapryx.transit.stops

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.sapryx.transit.R
import com.sapryx.transit.calendar.DayType
import com.sapryx.transit.routes.routeTitle
import com.sapryx.transit.ui.LoadableContent

private val dayTypeLabels = mapOf(DayType.Weekday to R.string.day_type_weekday, DayType.Weekend to R.string.day_type_weekend)

@Composable
fun StopScreen(onRouteClick: (Int) -> Unit, viewModel: StopViewModel = hiltViewModel()) {
    LoadableContent(viewModel.stop) { stop ->
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
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
            viewModel.dayType?.let { selected ->
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    DayType.entries.forEachIndexed { index, dayType ->
                        SegmentedButton(
                            selected = dayType == selected,
                            onClick = { viewModel.select(dayType) },
                            shape = SegmentedButtonDefaults.itemShape(index, DayType.entries.size),
                        ) { Text(stringResource(dayTypeLabels.getValue(dayType))) }
                    }
                }
            }
            LoadableContent(viewModel.schedule) { schedule ->
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    schedule.entries.forEach { DirectionSchedule(it, schedule.nowMinutes) }
                }
            }
        }
    }
}

@Composable
private fun DirectionSchedule(entry: StopScheduleEntry, nowMinutes: Int?) {
    val next = nowMinutes?.let { nextArrival(entry.arrivals, it) }
    Column(Modifier.testTag("direction-schedule"), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            "${stringResource(entry.mode.routeTitle(), entry.number)} · ${entry.directionName}",
            style = MaterialTheme.typography.titleMedium,
        )
        if (entry.arrivals.isEmpty()) {
            Text(stringResource(R.string.schedule_empty))
        }
        hourGroups(entry.arrivals).forEach { (hour, arrivals) ->
            Row(Modifier.semantics(mergeDescendants = true) {}.testTag("hour-row")) {
                Text(clockHour(hour), fontWeight = FontWeight.Bold, modifier = Modifier.width(32.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    arrivals.forEach { arrival ->
                        val highlight = if (arrival == next) {
                            Modifier.background(MaterialTheme.colorScheme.primaryContainer).testTag("next-arrival")
                        } else {
                            Modifier
                        }
                        Text(clockMinute(arrival), modifier = highlight)
                    }
                }
            }
        }
    }
}
