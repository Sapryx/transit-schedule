package com.sapryx.transit.time

import kotlinx.coroutines.flow.Flow

fun interface Ticker {
    fun ticks(): Flow<Unit>
}
