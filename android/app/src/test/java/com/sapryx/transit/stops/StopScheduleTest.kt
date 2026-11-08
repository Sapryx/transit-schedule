package com.sapryx.transit.stops

import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsNodeInteractionCollection
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
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
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.Clock
import java.time.LocalDateTime
import java.time.ZoneId

@HiltAndroidTest
@UninstallModules(ApiBaseUrlModule::class, ClockModule::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = HiltTestApplication::class)
class StopScheduleTest {
    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeRule = createEmptyComposeRule()

    private val fixtures = FixtureServer()

    @BindValue
    val baseUrl: HttpUrl = fixtures.url

    @BindValue
    @JvmField
    var clock: Clock = minskClock("2026-11-09T10:12:00")

    @After
    fun tearDown() {
        fixtures.shutdown()
    }

    private fun minskClock(localDateTime: String): Clock {
        val zone = ZoneId.of("Europe/Minsk")
        return Clock.fixed(LocalDateTime.parse(localDateTime).atZone(zone).toInstant(), zone)
    }

    private fun openVokzal(tab: String, stop: String) {
        ActivityScenario.launch(MainActivity::class.java)
        awaitText(tab)
        composeRule.onNodeWithText(tab).performClick()
        awaitText(stop)
        composeRule.onNodeWithText(stop).performClick()
    }

    private fun awaitText(text: String) {
        composeRule.waitUntil(5_000) { composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun SemanticsNodeInteractionCollection.texts() =
        fetchSemanticsNodes().map { it.joinedText() }

    private fun SemanticsNode.joinedText() = config[SemanticsProperties.Text].joinToString(" ")

    private fun hourRows(direction: String) =
        composeRule.onAllNodes(hasTestTag("hour-row") and hasAnyAncestor(hasTestTag("direction-schedule") and hasAnyDescendant(hasText(direction)))).texts()

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun groupsArrivalsByHourWithAfterMidnightTimesAtTheEnd() {
        openVokzal("Stops", "Vokzal")
        awaitText("Bus 10 · Vokzal → Lyubensky")

        assertEquals(listOf("06 05 20 35", "10 10 25", "00 10"), hourRows("Bus 10 · Vokzal → Lyubensky"))
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun startsOnTodaysDayTypeAndHighlightsTheNextArrival() {
        openVokzal("Stops", "Vokzal")
        awaitText("Bus 10 · Vokzal → Lyubensky")

        composeRule.onNodeWithText("Weekdays").assertIsSelected()
        composeRule.onNodeWithText("Weekends").assertIsNotSelected()
        assertEquals(listOf("25"), composeRule.onAllNodesWithTag("next-arrival", useUnmergedTree = true).texts())
        awaitText("No arrivals on these days")
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun switchesToTheWeekendScheduleWithoutHighlight() {
        openVokzal("Stops", "Vokzal")
        awaitText("Bus 10 · Vokzal → Lyubensky")

        composeRule.onNodeWithText("Weekends").performClick()
        composeRule.waitUntil(5_000) { hourRows("Trolleybus 15 · Vokzal → Volotova").isNotEmpty() }

        composeRule.onNodeWithText("Weekends").assertIsSelected()
        assertEquals(listOf("08 00", "09 00"), hourRows("Bus 10 · Vokzal → Lyubensky"))
        assertEquals(listOf("08 20"), hourRows("Trolleybus 15 · Vokzal → Volotova"))
        assertEquals(emptyList<String>(), composeRule.onAllNodesWithTag("next-arrival", useUnmergedTree = true).texts())
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun startsOnWeekendsOnAHoliday() {
        clock = minskClock("2026-12-25T08:30:00")
        openVokzal("Stops", "Vokzal")
        awaitText("Bus 10 · Vokzal → Lyubensky")

        composeRule.onNodeWithText("Weekends").assertIsSelected()
        assertEquals(listOf("00"), composeRule.onAllNodesWithTag("next-arrival", useUnmergedTree = true).texts())
    }

    @Test
    @Config(qualifiers = "ru-w411dp-h891dp")
    fun showsTheScheduleInRussian() {
        openVokzal("Остановки", "Вокзал")
        awaitText("Автобус 10 · Вокзал → Любенский")

        composeRule.onNodeWithText("Будни").assertIsSelected()
        awaitText("В эти дни рейсов нет")
        composeRule.onNodeWithText("Выходные").performClick()

        composeRule.waitUntil(5_000) { hourRows("Троллейбус 15 · Вокзал → Волотова").isNotEmpty() }
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun retriesTheScheduleAfterAnError() {
        openVokzal("Stops", "Vokzal")
        awaitText("Bus 10 · Vokzal → Lyubensky")
        fixtures.failures.set(1)

        composeRule.onNodeWithText("Weekends").performClick()
        awaitText("Retry")
        composeRule.onNodeWithText("Retry").performClick()

        composeRule.waitUntil(5_000) { hourRows("Trolleybus 15 · Vokzal → Volotova").isNotEmpty() }
    }
}
