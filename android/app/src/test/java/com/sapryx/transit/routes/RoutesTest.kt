package com.sapryx.transit.routes

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ActivityScenario
import com.sapryx.transit.MainActivity
import com.sapryx.transit.network.ApiBaseUrlModule
import com.sapryx.transit.testing.FixtureServer
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

@HiltAndroidTest
@UninstallModules(ApiBaseUrlModule::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = HiltTestApplication::class)
class RoutesTest {
    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeRule = createEmptyComposeRule()

    private val fixtures = FixtureServer()

    @BindValue
    val baseUrl: HttpUrl = fixtures.url

    @After
    fun tearDown() {
        fixtures.shutdown()
    }

    private fun launch() {
        ActivityScenario.launch(MainActivity::class.java)
    }

    private fun awaitText(text: String) {
        composeRule.waitUntil(5_000) { composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun top(text: String) = composeRule.onNodeWithText(text).fetchSemanticsNode().boundsInRoot.top

    private fun stopNames() =
        composeRule.onAllNodesWithTag("stop").fetchSemanticsNodes().map { it.config[SemanticsProperties.Text].joinToString() }

    private fun assertAbsent(text: String) {
        assertTrue(composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isEmpty())
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun groupsRoutesByModeSortedByNumber() {
        launch()
        awaitText("15")

        val order = listOf("Buses", "10", "10A", "43", "Trolleybuses", "2", "15").map(::top)

        assertEquals(order.sorted(), order)
        composeRule.onNodeWithText("Vokzal → Lyubensky via Rynok").assertIsDisplayed()
        composeRule.onNodeWithText("Vokzal → Volotova").assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "ru-w411dp-h891dp")
    fun showsRoutesInRussian() {
        launch()
        awaitText("15")

        composeRule.onNodeWithText("Автобусы").assertIsDisplayed()
        composeRule.onNodeWithText("Троллейбусы").assertIsDisplayed()
        composeRule.onNodeWithText("Вокзал → Любенский через Рынок").assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun filtersRoutesByNumber() {
        launch()
        awaitText("15")

        composeRule.onNodeWithTag("route-filter").performTextInput("1")

        listOf("10", "10A", "15").forEach { composeRule.onNodeWithText(it).assertIsDisplayed() }
        listOf("2", "43").forEach(::assertAbsent)

        composeRule.onNodeWithTag("route-filter").performTextReplacement("15")

        assertAbsent("Buses")
        composeRule.onNodeWithText("Trolleybuses").assertIsDisplayed()

        composeRule.onNodeWithTag("route-filter").performTextReplacement("9")

        composeRule.onNodeWithText("No routes").assertIsDisplayed()
        composeRule.onNodeWithText("Route number").assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "ru-w411dp-h891dp")
    fun filtersRoutesByNumberInRussian() {
        launch()
        awaitText("15")

        composeRule.onNodeWithText("Номер маршрута").assertIsDisplayed()
        composeRule.onNodeWithTag("route-filter").performTextInput("9")

        composeRule.onNodeWithText("Нет маршрутов").assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun titlesABusRoute() {
        launch()
        awaitText("10")

        composeRule.onNodeWithText("10").performClick()

        awaitText("Bus 10")
    }

    @Test
    @Config(qualifiers = "ru-w411dp-h891dp")
    fun titlesABusRouteInRussian() {
        launch()
        awaitText("10")

        composeRule.onNodeWithText("10").performClick()

        awaitText("Автобус 10")
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun showsAnErrorForAnUnexpectedResponse() {
        launch()
        awaitText("10A")

        composeRule.onNodeWithText("10A").performClick()

        awaitText("Retry")
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun showsLoadingWhileRoutesLoad() {
        fixtures.latencyMillis = 1_000
        launch()

        composeRule.onNodeWithTag("loading").assertIsDisplayed()
        awaitText("15")
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun retriesAfterAnError() {
        fixtures.failures.set(1)
        launch()
        awaitText("Retry")

        composeRule.onNodeWithText("Could not load data. Check your connection.").assertIsDisplayed()
        composeRule.onNodeWithText("Retry").performClick()

        awaitText("15")
    }

    @Test
    @Config(qualifiers = "ru-w411dp-h891dp")
    fun retriesAfterAnErrorInRussian() {
        fixtures.failures.set(1)
        launch()
        awaitText("Повторить")

        composeRule.onNodeWithText("Не удалось загрузить данные. Проверьте подключение.").assertIsDisplayed()
        composeRule.onNodeWithText("Повторить").performClick()

        awaitText("15")
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun showsStopsOfEachDirectionInTravelOrder() {
        launch()
        awaitText("15")

        composeRule.onNodeWithText("15").performClick()
        awaitText("Trolleybus 15")

        assertEquals(listOf("Volotova", "ulitsa Brovki", "Vokzal"), stopNames())

        composeRule.onNodeWithText("Vokzal → Volotova").performClick()

        assertEquals(listOf("Vokzal", "ulitsa Brovki", "Volotova"), stopNames())
    }

    @Test
    @Config(qualifiers = "ru-w411dp-h891dp")
    fun showsRouteInRussian() {
        launch()
        awaitText("15")

        composeRule.onNodeWithText("15").performClick()
        awaitText("Троллейбус 15")

        composeRule.onNodeWithText("Волотова → Вокзал").assertIsDisplayed()
        assertEquals(listOf("Волотова", "улица Бровки", "Вокзал"), stopNames())
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun opensTheStopScreenFromARoute() {
        launch()
        awaitText("15")
        composeRule.onNodeWithText("15").performClick()
        awaitText("ulitsa Brovki")

        composeRule.onNodeWithText("ulitsa Brovki").performClick()

        composeRule.onNodeWithTag("stop:101").assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "en-w411dp-h891dp")
    fun retriesARouteAfterAnError() {
        launch()
        awaitText("15")
        fixtures.failures.set(1)

        composeRule.onNodeWithText("15").performClick()
        awaitText("Retry")
        composeRule.onNodeWithText("Retry").performClick()

        awaitText("Trolleybus 15")
    }
}
