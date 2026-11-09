package com.sapryx.transit.journeys

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimeInput
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.sapryx.transit.R
import com.sapryx.transit.routes.routeTitle
import com.sapryx.transit.stops.Stop
import com.sapryx.transit.time.clockTime
import com.sapryx.transit.ui.LoadableContent
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.temporal.ChronoUnit

@Composable
fun JourneyScreen(
    onPickStop: (JourneyEnd) -> Unit,
    onRouteClick: (Int) -> Unit,
    onStopClick: (Int) -> Unit,
    viewModel: JourneyViewModel = hiltViewModel(),
) {
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                StopField(viewModel.from, R.string.journey_from, "journey-from") { onPickStop(JourneyEnd.Start) }
                StopField(viewModel.to, R.string.journey_to, "journey-to") { onPickStop(JourneyEnd.Destination) }
            }
            IconButton(onClick = viewModel::swap, modifier = Modifier.testTag("journey-swap")) {
                Icon(Icons.Filled.Refresh, contentDescription = stringResource(R.string.journey_swap))
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DateField(viewModel.date, viewModel::changeDate)
            TimeField(viewModel.time, viewModel::changeTime)
        }
        val journeys = viewModel.journeys
        if (journeys == null) {
            Text(stringResource(R.string.journey_hint))
        } else {
            LoadableContent(journeys) { found ->
                if (found.isEmpty()) {
                    Text(stringResource(R.string.journey_empty))
                }
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(found) { journey -> JourneyCard(journey, onRouteClick, onStopClick) }
                }
            }
        }
    }
}

@Composable
private fun StopField(stop: Stop?, label: Int, tag: String, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, modifier = Modifier.fillMaxWidth().testTag(tag)) {
        Text(stop?.name ?: stringResource(label))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateField(date: LocalDate, onChange: (LocalDate) -> Unit) {
    var open by rememberSaveable { mutableStateOf(false) }
    val locale = LocalConfiguration.current.locales[0]
    OutlinedButton(onClick = { open = true }, modifier = Modifier.testTag("journey-date")) {
        Text(date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(locale)))
    }
    if (open) {
        val state = rememberDatePickerState(initialSelectedDateMillis = date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli())
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(onClick = {
                    open = false
                    state.selectedDateMillis?.let { onChange(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()) }
                }) { Text(stringResource(R.string.ok)) }
            },
            dismissButton = { TextButton(onClick = { open = false }) { Text(stringResource(R.string.cancel)) } },
        ) {
            DatePicker(state)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimeField(time: LocalTime, onChange: (LocalTime) -> Unit) {
    var open by rememberSaveable { mutableStateOf(false) }
    OutlinedButton(onClick = { open = true }, modifier = Modifier.testTag("journey-time")) {
        Text(time.format(clockTime))
    }
    if (open) {
        val state = rememberTimePickerState(initialHour = time.hour, initialMinute = time.minute, is24Hour = true)
        AlertDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(onClick = {
                    open = false
                    onChange(LocalTime.of(state.hour, state.minute))
                }) { Text(stringResource(R.string.ok)) }
            },
            dismissButton = { TextButton(onClick = { open = false }) { Text(stringResource(R.string.cancel)) } },
            text = { TimeInput(state) },
        )
    }
}

@Composable
private fun JourneyCard(journey: Journey, onRouteClick: (Int) -> Unit, onStopClick: (Int) -> Unit) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    val minutes = minutesBetween(journey.departure, journey.arrival)
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().clickable { expanded = !expanded }.padding(12.dp)) {
            Text(
                "${journey.departure.clockTime()} → ${journey.arrival.clockTime()}",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.testTag("journey-times"),
            )
            Text(
                if (journey.transfers == 0) {
                    stringResource(R.string.journey_summary, minutes)
                } else {
                    pluralStringResource(R.plurals.journey_summary_transfers, journey.transfers, minutes, journey.transfers)
                },
            )
        }
        if (expanded) {
            journey.legs.forEachIndexed { index, leg ->
                if (index > 0) {
                    TransferDetails(journey.legs[index - 1], leg)
                }
                LegDetails(leg, onRouteClick, onStopClick)
            }
        }
    }
}

@Composable
private fun TransferDetails(arriving: Leg, departing: Leg) {
    val wait = minutesBetween(arriving.arrival, departing.departure)
    Text(
        stringResource(R.string.journey_transfer, arriving.toStop.name, wait),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.secondary,
        modifier = Modifier.padding(horizontal = 12.dp).testTag("leg-transfer"),
    )
}

private fun minutesBetween(from: String, to: String) = ChronoUnit.MINUTES.between(OffsetDateTime.parse(from), OffsetDateTime.parse(to)).toInt()

@Composable
private fun LegDetails(leg: Leg, onRouteClick: (Int) -> Unit, onStopClick: (Int) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            stringResource(leg.mode.routeTitle(), leg.number),
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.clickable { onRouteClick(leg.routeId) }.testTag("leg-route"),
        )
        Text(leg.directionName, style = MaterialTheme.typography.bodySmall)
        Text("${leg.departure.clockTime()} ${leg.fromStop.name}", Modifier.clickable { onStopClick(leg.fromStop.id) }.testTag("leg-from"))
        Text("${leg.arrival.clockTime()} ${leg.toStop.name}", Modifier.clickable { onStopClick(leg.toStop.id) }.testTag("leg-to"))
    }
}
