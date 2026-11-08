package com.sapryx.transit.journeys

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
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
import java.time.Instant
import java.time.ZoneId

@HiltAndroidTest
@UninstallModules(ApiBaseUrlModule::class, ClockModule::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = HiltTestApplication::class)
class JourneyTest {
    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeRule = createEmptyComposeRule()

    private val fixtures = FixtureServer()

    @BindValue
    val baseUrl: HttpUrl = fixtures.url

    @BindValue
    val clock: Clock = Clock.fixed(Instant.parse("2026-11-09T05:00:27Z"), ZoneId.of("Europe/Minsk"))

    @After
    fun tearDown() {
        fixtures.shutdown()
    }

    private fun openJourney(tab: String) {
        ActivityScenario.launch(MainActivity::class.java)
        awaitText(tab)
        composeRule.onNodeWithText(tab).performClick()
    }

    private fun awaitText(text: String) {
        composeRule.waitUntil(5_000) { composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun awaitTag(tag: String) {
        composeRule.waitUntil(5_000) { composeRule.onAllNodesWithTag(tag, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun pick(field: String, stop: String, beforeChoosing: () -> Unit = {}) {
        composeRule.onNodeWithTag(field).performClick()
        awaitTag("stop-search")
        awaitText(stop)
        beforeChoosing()
        composeRule.onNodeWithText(stop).performClick()
        awaitTag(field)
    }

    private fun summaries() = composeRule.onAllNodesWithTag("journey-times", useUnmergedTree = true).fetchSemanticsNodes().map { node ->
        node.config[androidx.compose.ui.semantics.SemanticsProperties.Text].joinToString()
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun startsNowAndAsksForStops() {
        openJourney("Journey")

        composeRule.onNodeWithTag("journey-time").assertTextEquals("08:00")
        composeRule.onNodeWithTag("journey-from").assertTextEquals("From")
        composeRule.onNodeWithTag("journey-to").assertTextEquals("To")
        composeRule.onNodeWithText("Choose start and destination stops").assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun findsDirectJourneysBetweenPickedStops() {
        openJourney("Journey")

        pick("journey-from", "Volotova")
        pick("journey-to", "Vokzal")

        awaitTag("journey-times")
        composeRule.onNodeWithTag("journey-from").assertTextEquals("Volotova")
        composeRule.onNodeWithTag("journey-to").assertTextEquals("Vokzal")
        assertEquals(listOf("08:05 → 08:31", "08:20 → 08:46"), summaries())
        composeRule.onAllNodesWithText("26 min, no transfers").onFirst().assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun swapsStartAndDestination() {
        openJourney("Journey")
        pick("journey-from", "Volotova")
        pick("journey-to", "Vokzal")
        awaitTag("journey-times")

        composeRule.onNodeWithTag("journey-swap").performClick()

        composeRule.waitUntil(5_000) { summaries() == listOf("08:10 → 08:36") }
        composeRule.onNodeWithTag("journey-from").assertTextEquals("Vokzal")
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun expandsAJourneyIntoItsLegAndOpensItsRouteAndStop() {
        openJourney("Journey")
        pick("journey-from", "Volotova")
        pick("journey-to", "Vokzal")
        awaitTag("journey-times")

        composeRule.onAllNodesWithTag("journey-times", useUnmergedTree = true).onFirst().performClick()

        composeRule.onNodeWithTag("leg-route").assertTextEquals("Trolleybus 15")
        composeRule.onNodeWithText("Volotova → Vokzal").assertIsDisplayed()
        composeRule.onNodeWithTag("leg-from").assertTextEquals("08:05 Volotova")
        composeRule.onNodeWithTag("leg-to").assertTextEquals("08:31 Vokzal")

        composeRule.onNodeWithTag("leg-to").performClick()
        awaitTag("stop-name")
        composeRule.onNodeWithTag("stop-name").assertTextEquals("Vokzal")
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun opensTheRouteOfALeg() {
        openJourney("Journey")
        pick("journey-from", "Volotova")
        pick("journey-to", "Vokzal")
        awaitTag("journey-times")
        composeRule.onAllNodesWithTag("journey-times", useUnmergedTree = true).onFirst().performClick()

        composeRule.onNodeWithTag("leg-route").performClick()

        awaitText("Vokzal → Volotova")
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun searchesAnotherDateAndTime() {
        openJourney("Journey")
        pick("journey-from", "Volotova")
        pick("journey-to", "Vokzal")
        awaitTag("journey-times")

        composeRule.onNodeWithTag("journey-date").performClick()
        composeRule.onNodeWithText("November 12", substring = true).performClick()
        composeRule.onNodeWithText("OK").performClick()
        composeRule.onNodeWithTag("journey-time").performClick()
        composeRule.onAllNodes(hasSetTextAction())[0].performTextReplacement("09")
        composeRule.onAllNodes(hasSetTextAction())[1].performTextReplacement("30")
        composeRule.onNodeWithText("OK").performClick()

        composeRule.waitUntil(5_000) { summaries() == listOf("09:35 → 10:01") }
        composeRule.onNodeWithTag("journey-time").assertTextEquals("09:30")
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun labelsTheSwapButtonAndDialogButtons() {
        openJourney("Journey")

        composeRule.onNodeWithContentDescription("Swap stops").assertIsDisplayed()
        composeRule.onNodeWithTag("journey-time").performClick()
        composeRule.onNodeWithText("OK").assertIsDisplayed()
        composeRule.onNodeWithText("Cancel").performClick()
        composeRule.onNodeWithTag("journey-time").assertTextEquals("08:00")
    }

    @Test
    @Config(qualifiers = "ru-w411dp-h891dp")
    fun labelsTheSwapButtonAndDialogButtonsInRussian() {
        openJourney("Поездка")

        composeRule.onNodeWithContentDescription("Поменять местами").assertIsDisplayed()
        composeRule.onNodeWithTag("journey-date").performClick()
        composeRule.onNodeWithText("ОК").assertIsDisplayed()
        composeRule.onNodeWithText("Отмена").performClick()
        composeRule.onNodeWithTag("journey-time").assertTextEquals("08:00")
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun saysWhenNoJourneyIsFound() {
        openJourney("Journey")
        pick("journey-from", "ulitsa Brovki")
        pick("journey-to", "Vokzal")

        awaitText("No journeys within two hours. Try another time.")
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun retriesAfterAnError() {
        openJourney("Journey")
        pick("journey-from", "Volotova")
        pick("journey-to", "Vokzal") { fixtures.failures.set(1) }

        awaitText("Retry")
        composeRule.onNodeWithText("Retry").performClick()

        awaitTag("journey-times")
    }

    @Test
    @Config(qualifiers = "ru-w411dp-h891dp")
    fun showsJourneysInRussian() {
        openJourney("Поездка")
        composeRule.onNodeWithText("Выберите остановки отправления и назначения").assertIsDisplayed()
        composeRule.onNodeWithTag("journey-from").assertTextEquals("Откуда")
        composeRule.onNodeWithTag("journey-to").assertTextEquals("Куда")

        pick("journey-from", "Волотова")
        pick("journey-to", "Вокзал")
        awaitTag("journey-times")
        composeRule.onAllNodesWithText("26 мин, без пересадок").onFirst().assertIsDisplayed()
        composeRule.onAllNodesWithTag("journey-times", useUnmergedTree = true).onFirst().performClick()

        composeRule.onNodeWithTag("leg-route").assertTextEquals("Троллейбус 15")
        composeRule.onNodeWithTag("leg-from").assertTextEquals("08:05 Волотова")
    }

    @Test
    @Config(qualifiers = "ru-w411dp-h891dp")
    fun saysWhenNoJourneyIsFoundInRussian() {
        openJourney("Поездка")
        pick("journey-from", "улица Бровки")
        pick("journey-to", "Вокзал")

        awaitText("Нет поездок в ближайшие два часа. Выберите другое время.")
    }
}
