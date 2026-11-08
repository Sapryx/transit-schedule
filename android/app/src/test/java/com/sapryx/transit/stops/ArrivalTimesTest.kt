package com.sapryx.transit.stops

import org.junit.Assert.assertEquals
import org.junit.Test

class ArrivalTimesTest {
    @Test
    fun groupsArrivalsByHourKeepingAfterMidnightHoursLast() {
        assertEquals(listOf(6 to listOf(365, 380), 23 to listOf(1435), 24 to listOf(1450)), hourGroups(listOf(365, 380, 1435, 1450)))
    }

    @Test
    fun formatsHoursAndMinutesAsClockTimes() {
        assertEquals(listOf("06", "23", "00", "01"), listOf(6, 23, 24, 25).map(::clockHour))
        assertEquals(listOf("05", "59", "10"), listOf(365, 1439, 1450).map(::clockMinute))
    }

    @Test
    fun findsTheNextArrivalAtOrAfterNow() {
        assertEquals(625, nextArrival(listOf(365, 610, 625, 1450), 612))
        assertEquals(610, nextArrival(listOf(365, 610), 610))
        assertEquals(null, nextArrival(listOf(365, 610), 611))
    }
}
