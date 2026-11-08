package com.sapryx.transit.routes

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.GET
import retrofit2.http.Path

@Serializable
enum class TransportMode {
    @SerialName("bus")
    Bus,

    @SerialName("trolleybus")
    Trolleybus,
}

@Serializable
data class DirectionSummary(val id: Int, val name: String)

@Serializable
data class RouteSummary(val id: Int, val number: String, val mode: TransportMode, val directions: List<DirectionSummary>)

@Serializable
data class RouteStop(val stopId: Int, val platformId: Int, val name: String, val lat: Double, val lon: Double, val travelOffset: Int)

@Serializable
data class DirectionDetail(val id: Int, val name: String, val stops: List<RouteStop>, val path: List<List<Double>>)

@Serializable
data class RouteDetail(val id: Int, val number: String, val mode: TransportMode, val directions: List<DirectionDetail>)

interface RoutesApi {
    @GET("api/routes")
    suspend fun routes(): List<RouteSummary>

    @GET("api/routes/{id}")
    suspend fun route(@Path("id") id: Int): RouteDetail
}
