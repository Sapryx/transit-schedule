package com.sapryx.transit

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.sapryx.transit.network.ApiBaseUrlModule
import com.sapryx.transit.testing.FixtureServer
import dagger.hilt.android.testing.BindValue
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import dagger.hilt.android.testing.HiltTestApplication
import dagger.hilt.android.testing.UninstallModules
import okhttp3.HttpUrl
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@HiltAndroidTest
@UninstallModules(ApiBaseUrlModule::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], application = HiltTestApplication::class)
class TransitAppTest {
    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeRule = createAndroidComposeRule<MainActivity>()

    private val fixtures = FixtureServer()

    @BindValue
    val baseUrl: HttpUrl = fixtures.url

    @After
    fun tearDown() {
        fixtures.shutdown()
    }

    private fun opensEveryTab(placeholderTabs: List<String>, routesTab: String) {
        placeholderTabs.forEach { tab ->
            composeRule.onNodeWithText(tab).performClick()
            composeRule.onNodeWithTag("placeholder").assertIsDisplayed()
            composeRule.onNodeWithTag("placeholder").assertTextEquals(tab)
        }

        composeRule.onNodeWithText(routesTab).performClick()

        composeRule.onNodeWithTag("route-filter").assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "en")
    fun opensEveryTabInEnglish() {
        opensEveryTab(listOf("Journey", "Map", "Favourites"), "Routes")
    }

    @Test
    @Config(qualifiers = "ru")
    fun opensEveryTabInRussian() {
        opensEveryTab(listOf("Поездка", "Карта", "Избранное"), "Маршруты")
    }
}
