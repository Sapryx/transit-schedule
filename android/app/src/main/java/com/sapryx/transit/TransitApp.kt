package com.sapryx.transit

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource

@Composable
fun TransitApp() {
    MaterialTheme {
        Text(stringResource(R.string.app_name))
    }
}
