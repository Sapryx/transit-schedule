package com.sapryx.transit.stops

import com.sapryx.transit.routes.TransportMode
import kotlinx.serialization.Serializable
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

@Serializable
data class StopRoute(val id: Int, val number: String, val mode: TransportMode)

@Serializable
data class Stop(val id: Int, val name: String, val routes: List<StopRoute>)

@Serializable
data class StopScheduleEntry(
    val routeId: Int,
    val number: String,
    val mode: TransportMode,
    val directionId: Int,
    val directionName: String,
    val arrivals: List<Int>,
)

interface StopsApi {
    @GET("api/stops")
    suspend fun stops(@Query("query") query: String): List<Stop>

    @GET("api/stops/{id}")
    suspend fun stop(@Path("id") id: Int): Stop

    @GET("api/stops/{id}/schedule")
    suspend fun schedule(@Path("id") id: Int, @Query("dayType") dayType: String): List<StopScheduleEntry>
}
