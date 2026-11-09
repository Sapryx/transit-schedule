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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.sapryx.transit.R
import com.sapryx.transit.calendar.DayType
import com.sapryx.transit.routes.routeTitle
import com.sapryx.transit.time.clockTime
import com.sapryx.transit.ui.LoadableContent

private val dayTypeLabels = mapOf(DayType.Weekday to R.string.day_type_weekday, DayType.Weekend to R.string.day_type_weekend)

@Composable
fun StopScreen(onRouteClick: (Int) -> Unit, viewModel: StopViewModel = hiltViewModel()) {
    val lifecycleOwner = LocalLifecycleOwner.current
    LaunchedEffect(viewModel, lifecycleOwner) {
        lifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) { viewModel.keepUpcomingFresh() }
    }
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
            Text(stringResource(R.string.upcoming_title), style = MaterialTheme.typography.titleMedium)
            LoadableContent(viewModel.upcoming) { arrivals ->
                UpcomingArrivals(arrivals)
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
private fun UpcomingArrivals(arrivals: List<UpcomingArrival>) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (arrivals.isEmpty()) {
            Text(stringResource(R.string.upcoming_empty))
        }
        arrivals.forEach { arrival ->
            Row(
                Modifier.fillMaxWidth().semantics(mergeDescendants = true) {}.testTag("upcoming-arrival"),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("${stringResource(arrival.mode.routeTitle(), arrival.number)} · ${arrival.directionName}", Modifier.weight(1f))
                Text("${arrival.arrival.clockTime()} · ${stringResource(R.string.upcoming_minutes, arrival.minutesUntil)}")
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
