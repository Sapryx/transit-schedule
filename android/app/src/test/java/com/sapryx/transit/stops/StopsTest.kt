package com.sapryx.transit.stops

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import com.sapryx.transit.MainActivity
import com.sapryx.transit.network.ApiBaseUrlModule
import com.sapryx.transit.testing.FixtureServer
import com.sapryx.transit.time.ClockModule
import dagger.hilt.android.testing.BindValue
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import dagger.hilt.android.testing.HiltTestApplication
import dagger.hilt.android.testing.UninstallModules
import okhttp3.HttpUrl
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

@HiltAndroidTest
@UninstallModules(ApiBaseUrlModule::class, ClockModule::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = HiltTestApplication::class)
class StopsTest {
    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeRule = createEmptyComposeRule()

    private val fixtures = FixtureServer()

    @BindValue
    val baseUrl: HttpUrl = fixtures.url

    @BindValue
    val clock: Clock = Clock.fixed(Instant.parse("2026-11-09T07:12:00Z"), ZoneId.of("Europe/Minsk"))

    @After
    fun tearDown() {
        fixtures.shutdown()
    }

    private fun openStops(tab: String) {
        ActivityScenario.launch(MainActivity::class.java)
        awaitText(tab)
        composeRule.onNodeWithText(tab).performClick()
    }

    private fun awaitText(text: String) {
        composeRule.waitUntil(5_000) { composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun top(text: String) = composeRule.onNodeWithText(text).fetchSemanticsNode().boundsInRoot.top

    private fun assertAbsent(text: String) {
        assertTrue(composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isEmpty())
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun listsAllStopsBeforeSearching() {
        openStops("Stops")
        awaitText("Lyubensky")

        val order = listOf("Lyubensky", "ulitsa Brovki", "Vokzal", "Volotova").map(::top)

        assertEquals(order.sorted(), order)
        composeRule.onNodeWithText("Stop name").assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun searchesStopsAndShowsTheirRoutes() {
        openStops("Stops")
        awaitText("Lyubensky")

        composeRule.onNodeWithTag("stop-search").performTextInput("vo")
        composeRule.waitUntil(5_000) { composeRule.onAllNodesWithText("Lyubensky").fetchSemanticsNodes().isEmpty() }

        composeRule.onNodeWithText("Vokzal").assertIsDisplayed()
        composeRule.onNodeWithText("Trolleybus 2, Bus 10, Bus 10A, Trolleybus 15").assertIsDisplayed()
        composeRule.onNodeWithText("Trolleybus 15, Bus 43").assertIsDisplayed()
        assertAbsent("ulitsa Brovki")
    }

    @Test
    @Config(qualifiers = "ru-w411dp-h891dp")
    fun searchesStopsInRussian() {
        openStops("Остановки")
        awaitText("Любенский")

        composeRule.onNodeWithText("Название остановки").assertIsDisplayed()
        composeRule.onNodeWithTag("stop-search").performTextInput("во")
        composeRule.waitUntil(5_000) { composeRule.onAllNodesWithText("Любенский").fetchSemanticsNodes().isEmpty() }

        composeRule.onNodeWithText("Троллейбус 2, Автобус 10, Автобус 10A, Троллейбус 15").assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun saysWhenNoStopMatches() {
        openStops("Stops")
        awaitText("Lyubensky")

        composeRule.onNodeWithTag("stop-search").performTextInput("zz")

        awaitText("No stops")
    }

    @Test
    @Config(qualifiers = "ru-w411dp-h891dp")
    fun saysWhenNoStopMatchesInRussian() {
        openStops("Остановки")
        awaitText("Любенский")

        composeRule.onNodeWithTag("stop-search").performTextInput("яя")

        awaitText("Нет остановок")
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun opensTheStopScreenFromSearch() {
        openStops("Stops")
        awaitText("Vokzal")

        composeRule.onNodeWithText("Vokzal").performClick()

        awaitText("Bus 10A")
        composeRule.onNodeWithTag("stop-name").assertIsDisplayed()
        val chips = composeRule.onAllNodesWithTag("route-chip").fetchSemanticsNodes().map { it.config[SemanticsProperties.Text].joinToString() }
        assertEquals(listOf("Trolleybus 2", "Bus 10", "Bus 10A", "Trolleybus 15"), chips)
    }

    @Test
    @Config(qualifiers = "ru-w411dp-h891dp")
    fun showsTheStopScreenInRussian() {
        openStops("Остановки")
        awaitText("Вокзал")

        composeRule.onNodeWithText("Вокзал").performClick()

        awaitText("Автобус 10A")
        composeRule.onNodeWithText("Троллейбус 15").assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun opensARouteFromTheStopScreen() {
        openStops("Stops")
        awaitText("Vokzal")
        composeRule.onNodeWithText("Vokzal").performClick()
        awaitText("Trolleybus 15")

        composeRule.onNodeWithText("Trolleybus 15").performClick()

        awaitText("Vokzal → Volotova")
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun retriesASearchAfterAnError() {
        openStops("Stops")
        awaitText("Lyubensky")
        fixtures.failures.set(1)

        composeRule.onNodeWithTag("stop-search").performTextInput("vo")
        awaitText("Retry")
        composeRule.onNodeWithText("Retry").performClick()

        awaitText("Volotova")
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun retriesTheStopScreenAfterAnError() {
        openStops("Stops")
        awaitText("Vokzal")
        fixtures.failures.set(1)

        composeRule.onNodeWithText("Vokzal").performClick()
        awaitText("Retry")
        composeRule.onNodeWithText("Retry").performClick()

        awaitText("Bus 10A")
    }
}
