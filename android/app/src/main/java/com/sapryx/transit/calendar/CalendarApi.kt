package com.sapryx.transit.calendar

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.GET
import retrofit2.http.Query

@Serializable
enum class DayType {
    @SerialName("weekday")
    Weekday,

    @SerialName("weekend")
    Weekend,
    ;

    val query get() = name.lowercase()
}

@Serializable
data class DayInfo(val date: String, val dayType: DayType, val holiday: Boolean)

interface CalendarApi {
    @GET("api/calendar/day-type")
    suspend fun dayType(@Query("date") date: String): DayInfo
}
