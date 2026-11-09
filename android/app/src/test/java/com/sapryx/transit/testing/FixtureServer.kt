package com.sapryx.transit.testing

import okhttp3.HttpUrl
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class FixtureServer {
    private val server = MockWebServer()
    val failures = AtomicInteger()
    val requests = ConcurrentLinkedQueue<String>()

    @Volatile
    var latencyMillis = 0L
    val url: HttpUrl = server.url("/")

    init {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                if (failures.getAndUpdate { maxOf(it - 1, 0) } > 0) {
                    return MockResponse().setResponseCode(500)
                }
                val url = request.requestUrl!!
                val path = (url.encodedPath.removePrefix("/api/") + (url.query?.let { "/$it" } ?: "")).replace(':', '_')
                requests.add(path)
                val fixture = javaClass.getResource("/fixtures/$path.${request.getHeader("Accept-Language")}.json")
                    ?: return MockResponse().setResponseCode(404)
                return MockResponse().setBody(fixture.readText()).setBodyDelay(latencyMillis, TimeUnit.MILLISECONDS)
            }
        }
    }

    fun shutdown() = server.shutdown()
}
