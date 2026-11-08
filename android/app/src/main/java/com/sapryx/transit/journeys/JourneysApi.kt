package com.sapryx.transit.journeys

import com.sapryx.transit.routes.TransportMode
import kotlinx.serialization.Serializable
import retrofit2.http.GET
import retrofit2.http.Query

@Serializable
data class JourneyStop(val id: Int, val name: String)

@Serializable
data class Leg(
    val routeId: Int,
    val number: String,
    val mode: TransportMode,
    val directionId: Int,
    val directionName: String,
    val fromStop: JourneyStop,
    val toStop: JourneyStop,
    val departure: String,
    val arrival: String,
)

@Serializable
data class Journey(val departure: String, val arrival: String, val transfers: Int, val legs: List<Leg>)

interface JourneysApi {
    @GET("api/journeys")
    suspend fun journeys(@Query("from") from: Int, @Query("to") to: Int, @Query("at") at: String): List<Journey>
}
