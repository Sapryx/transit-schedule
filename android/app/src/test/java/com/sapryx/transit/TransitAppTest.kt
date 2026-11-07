package com.sapryx.transit

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
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

    @Test
    @Config(qualifiers = "en")
    fun showsAppTitleInEnglish() {
        composeRule.setContent { TransitApp() }

        composeRule.onNodeWithText("Transit Schedule").assertIsDisplayed()
    }

    @Test
    @Config(qualifiers = "ru")
    fun showsAppTitleInRussian() {
        composeRule.setContent { TransitApp() }

        composeRule.onNodeWithText("Расписание транспорта").assertIsDisplayed()
    }
}
