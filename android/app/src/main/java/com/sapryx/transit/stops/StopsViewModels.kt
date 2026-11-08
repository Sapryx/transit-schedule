package com.sapryx.transit.stops

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sapryx.transit.ui.Loadable
import dagger.hilt.android.lifecycle.HiltViewModel
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

@HiltViewModel
class StopViewModel @Inject constructor(api: StopsApi, savedStateHandle: SavedStateHandle) : ViewModel() {
    private val stopId: Int = checkNotNull(savedStateHandle[STOP_ID])

    val stop = Loadable(viewModelScope) { api.stop(stopId) }

    companion object {
        const val STOP_ID = "stopId"
    }
}
