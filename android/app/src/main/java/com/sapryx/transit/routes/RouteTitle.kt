package com.sapryx.transit.routes

import com.sapryx.transit.R

fun TransportMode.routeTitle() = when (this) {
    TransportMode.Bus -> R.string.route_title_bus
    TransportMode.Trolleybus -> R.string.route_title_trolleybus
}
