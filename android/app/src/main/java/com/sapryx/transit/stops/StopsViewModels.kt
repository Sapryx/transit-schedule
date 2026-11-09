package com.sapryx.transit.stops

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sapryx.transit.calendar.CalendarApi
import com.sapryx.transit.calendar.DayType
import com.sapryx.transit.time.Ticker
import com.sapryx.transit.ui.Loadable
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Clock
import java.time.LocalDate
import java.time.LocalTime
import java.time.OffsetDateTime
import javax.inject.Inject

@HiltViewModel
class StopsViewModel @Inject constructor(api: StopsApi) : ViewModel() {
    var query by mutableStateOf("")
        private set

    val stops = Loadable(viewModelScope) { api.stops(query.trim()) }

    fun search(query: String) {
        this.query = query
        stops.load()
    }
}

data class DaySchedule(val entries: List<StopScheduleEntry>, val nowMinutes: Int?)

@HiltViewModel
class StopViewModel @Inject constructor(
    api: StopsApi,
    calendarApi: CalendarApi,
    clock: Clock,
    private val ticker: Ticker,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {
    private val stopId: Int = checkNotNull(savedStateHandle[STOP_ID])
    private var todayType: DayType? = null

    var dayType by mutableStateOf<DayType?>(null)
        private set

    val stop = Loadable(viewModelScope) { api.stop(stopId) }

    val upcoming = Loadable(viewModelScope) { api.upcoming(stopId, OffsetDateTime.now(clock).toString()) }

    val schedule = Loadable(viewModelScope) {
        val today = todayType ?: calendarApi.dayType(LocalDate.now(clock).toString()).dayType.also { todayType = it }
        val selected = dayType ?: today.also { dayType = it }
        val now = LocalTime.now(clock)
        DaySchedule(api.schedule(stopId, selected.query), (now.hour * 60 + now.minute).takeIf { selected == today })
    }

    suspend fun keepUpcomingFresh() {
        ticker.ticks().collect { upcoming.refresh() }
    }

    fun select(dayType: DayType) {
        this.dayType = dayType
        schedule.load()
    }

    companion object {
        const val STOP_ID = "stopId"
    }
}
