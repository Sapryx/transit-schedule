package com.sapryx.transit.network

import dagger.hilt.android.testing.BindValue
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import dagger.hilt.android.testing.HiltTestApplication
import dagger.hilt.android.testing.UninstallModules
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.Serializable
import okhttp3.HttpUrl
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import retrofit2.Retrofit
import retrofit2.http.GET
import javax.inject.Inject

@Serializable
data class Probe(val ok: Boolean)

interface ProbeApi {
    @GET("probe")
    suspend fun probe(): Probe
}

@HiltAndroidTest
@UninstallModules(ApiBaseUrlModule::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = HiltTestApplication::class)
class AcceptLanguageTest {
    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    private val server = MockWebServer()

    @BindValue
    val baseUrl: HttpUrl = server.url("/")

    @Inject
    lateinit var retrofit: Retrofit

    @Before
    fun setUp() {
        hiltRule.inject()
        server.enqueue(MockResponse().setBody("""{"ok":true}"""))
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    @Config(qualifiers = "en")
    fun sendsEnglishLocale() = runTest {
        assertEquals(Probe(ok = true), retrofit.create(ProbeApi::class.java).probe())

        assertEquals("en", server.takeRequest().getHeader("Accept-Language"))
    }

    @Test
    @Config(qualifiers = "ru")
    fun sendsRussianLocale() = runTest {
        retrofit.create(ProbeApi::class.java).probe()

        assertEquals("ru", server.takeRequest().getHeader("Accept-Language"))
    }
}
