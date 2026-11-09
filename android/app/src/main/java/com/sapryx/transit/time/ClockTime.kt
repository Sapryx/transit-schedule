package com.sapryx.transit.time

import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

val clockTime: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm")

fun String.clockTime(): String = OffsetDateTime.parse(this).format(clockTime)
