package com.sapryx.transit.stops

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import com.sapryx.transit.MainActivity
import com.sapryx.transit.network.ApiBaseUrlModule
import com.sapryx.transit.testing.FixtureServer
import com.sapryx.transit.testing.MutableClock
import com.sapryx.transit.time.ClockModule
import com.sapryx.transit.time.Ticker
import com.sapryx.transit.time.TickerModule
import dagger.hilt.android.testing.BindValue
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import dagger.hilt.android.testing.HiltTestApplication
import dagger.hilt.android.testing.UninstallModules
import kotlinx.coroutines.flow.MutableSharedFlow
import okhttp3.HttpUrl
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.Clock

@HiltAndroidTest
@UninstallModules(ApiBaseUrlModule::class, ClockModule::class, TickerModule::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = HiltTestApplication::class)
class UpcomingArrivalsTest {
    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeRule = createEmptyComposeRule()

    private val fixtures = FixtureServer()

    private val mutableClock = MutableClock("2026-11-09T10:12:00")

    private val ticks = MutableSharedFlow<Unit>(extraBufferCapacity = 1)

    @BindValue
    val baseUrl: HttpUrl = fixtures.url

    @BindValue
    val clock: Clock = mutableClock

    @BindValue
    val ticker: Ticker = Ticker { ticks }

    @After
    fun tearDown() {
        fixtures.shutdown()
    }

    private fun openVokzal(tab: String, stop: String): ActivityScenario<MainActivity> {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        awaitText(tab)
        composeRule.onNodeWithText(tab).performClick()
        awaitText(stop)
        composeRule.onNodeWithText(stop).performClick()
        return scenario
    }

    private fun awaitText(text: String) {
        composeRule.waitUntil(5_000) { composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun upcoming() =
        composeRule.onAllNodesWithTag("upcoming-arrival").fetchSemanticsNodes().map { it.config[SemanticsProperties.Text].joinToString(" ") }

    private fun awaitUpcoming(expected: List<String>) {
        composeRule.waitUntil(5_000) { upcoming() == expected }
    }

    private fun tickAt(localDateTime: String) {
        mutableClock.instant = MutableClock(localDateTime).instant
        composeRule.runOnIdle { ticks.tryEmit(Unit) }
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun listsTheNextArrivalsSoonestFirstWithMinutesToGo() {
        openVokzal("Stops", "Vokzal")
        awaitText("Upcoming arrivals")

        awaitUpcoming(listOf("Bus 10 · Vokzal → Lyubensky 10:25 · in 13 min", "Trolleybus 15 · Vokzal → Volotova 10:40 · in 28 min"))
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun refreshesOnEveryTickWhileVisible() {
        openVokzal("Stops", "Vokzal")
        awaitUpcoming(listOf("Bus 10 · Vokzal → Lyubensky 10:25 · in 13 min", "Trolleybus 15 · Vokzal → Volotova 10:40 · in 28 min"))

        tickAt("2026-11-09T10:12:30")

        awaitUpcoming(listOf("Bus 10 · Vokzal → Lyubensky 10:25 · in 12 min", "Trolleybus 15 · Vokzal → Volotova 10:40 · in 27 min"))
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun refreshesWhenShownAgainButNotWhileHidden() {
        val scenario = openVokzal("Stops", "Vokzal")
        awaitUpcoming(listOf("Bus 10 · Vokzal → Lyubensky 10:25 · in 13 min", "Trolleybus 15 · Vokzal → Volotova 10:40 · in 28 min"))

        scenario.moveToState(Lifecycle.State.CREATED)
        tickAt("2026-11-09T10:12:30")
        mutableClock.instant = MutableClock("2026-11-09T23:30:00").instant
        scenario.moveToState(Lifecycle.State.RESUMED)

        awaitText("Nothing arrives in the next three hours")
        assertEquals(emptyList<String>(), fixtures.requests.filter { "10_12_30" in it })
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun saysWhenNothingMoreArrives() {
        mutableClock.instant = MutableClock("2026-11-09T23:30:00").instant
        openVokzal("Stops", "Vokzal")

        awaitText("Nothing arrives in the next three hours")
        assertEquals(emptyList<String>(), upcoming())
    }

    @Test
    @Config(qualifiers = "ru-w411dp-h891dp")
    fun showsUpcomingArrivalsInRussian() {
        openVokzal("Остановки", "Вокзал")
        awaitText("Ближайшие прибытия")

        awaitUpcoming(listOf("Автобус 10 · Вокзал → Любенский 10:25 · через 13 мин", "Троллейбус 15 · Вокзал → Волотова 10:40 · через 28 мин"))
    }

    @Test
    @Config(qualifiers = "ru-w411dp-h891dp")
    fun saysWhenNothingMoreArrivesInRussian() {
        mutableClock.instant = MutableClock("2026-11-09T23:30:00").instant
        openVokzal("Остановки", "Вокзал")

        awaitText("В ближайшие три часа рейсов нет")
    }
}
