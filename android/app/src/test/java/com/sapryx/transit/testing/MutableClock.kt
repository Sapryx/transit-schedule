package com.sapryx.transit.testing

import java.time.Clock
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId

class MutableClock(localDateTime: String, private val zone: ZoneId = ZoneId.of("Europe/Minsk")) : Clock() {
    @Volatile
    var instant: Instant = LocalDateTime.parse(localDateTime).atZone(zone).toInstant()

    override fun getZone(): ZoneId = zone

    override fun withZone(zone: ZoneId): Clock = this

    override fun instant(): Instant = instant
}
