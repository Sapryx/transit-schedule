package com.sapryx.transit.routes

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sapryx.transit.ui.Loadable
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class RoutesViewModel @Inject constructor(api: RoutesApi) : ViewModel() {
    val routes = Loadable(viewModelScope) { api.routes() }
}

@HiltViewModel
class RouteViewModel @Inject constructor(api: RoutesApi, savedStateHandle: SavedStateHandle) : ViewModel() {
    private val routeId: Int = checkNotNull(savedStateHandle[ROUTE_ID])

    val route = Loadable(viewModelScope) { api.route(routeId) }

    companion object {
        const val ROUTE_ID = "routeId"
    }
}
