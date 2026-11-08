package com.sapryx.transit.stops

fun hourGroups(arrivals: List<Int>): List<Pair<Int, List<Int>>> = arrivals.groupBy { it / 60 }.toList()

fun clockHour(hour: Int): String = "%02d".format(hour % 24)

fun clockMinute(minutes: Int): String = "%02d".format(minutes % 60)

fun nextArrival(arrivals: List<Int>, now: Int): Int? = arrivals.firstOrNull { it >= now }
