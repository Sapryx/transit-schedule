package com.sapryx.transit.journeys

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sapryx.transit.stops.Stop
import com.sapryx.transit.ui.Loadable
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Clock
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit
import javax.inject.Inject

enum class JourneyEnd { Start, Destination }

@HiltViewModel
class JourneyViewModel @Inject constructor(private val api: JourneysApi, private val clock: Clock) : ViewModel() {
    var from by mutableStateOf<Stop?>(null)
        private set

    var to by mutableStateOf<Stop?>(null)
        private set

    var date: LocalDate by mutableStateOf(LocalDate.now(clock))
        private set

    var time: LocalTime by mutableStateOf(LocalTime.now(clock).truncatedTo(ChronoUnit.MINUTES))
        private set

    var journeys by mutableStateOf<Loadable<List<Journey>>?>(null)
        private set

    fun choose(end: JourneyEnd, stop: Stop) {
        when (end) {
            JourneyEnd.Start -> from = stop
            JourneyEnd.Destination -> to = stop
        }
        search()
    }

    fun swap() {
        from = to.also { to = from }
        search()
    }

    fun changeDate(date: LocalDate) {
        this.date = date
        search()
    }

    fun changeTime(time: LocalTime) {
        this.time = time
        search()
    }

    private fun search() {
        val start = from
        val destination = to
        val at = ZonedDateTime.of(date, time, clock.zone).toOffsetDateTime().toString()
        journeys = if (start != null && destination != null && start.id != destination.id) {
            Loadable(viewModelScope) { api.journeys(start.id, destination.id, at) }
        } else {
            null
        }
    }
}
