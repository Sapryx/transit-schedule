package com.sapryx.transit

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class TransitAppTest {
    @get:Rule
    val composeRule = createComposeRule()

    private fun opensEveryTab(tabs: List<String>) {
        composeRule.setContent { TransitApp() }

        tabs.forEach { tab ->
            composeRule.onNodeWithText(tab).performClick()
            composeRule.onNodeWithTag("placeholder").assertIsDisplayed()
            composeRule.onNodeWithTag("placeholder").assertTextEquals(tab)
        }
    }

    @Test
    @Config(qualifiers = "en")
    fun opensEveryTabInEnglish() {
        opensEveryTab(listOf("Stops", "Journey", "Map", "Favourites", "Routes"))
    }

    @Test
    @Config(qualifiers = "ru")
    fun opensEveryTabInRussian() {
        opensEveryTab(listOf("Остановки", "Поездка", "Карта", "Избранное", "Маршруты"))
    }
}
