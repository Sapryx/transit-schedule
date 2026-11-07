package com.sapryx.transit.navigation

import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Search
import androidx.compose.ui.graphics.vector.ImageVector
import com.sapryx.transit.R

enum class Tab(@StringRes val title: Int, val icon: ImageVector) {
    Routes(R.string.tab_routes, Icons.Filled.DateRange),
    Stops(R.string.tab_stops, Icons.Filled.Home),
    Journey(R.string.tab_journey, Icons.Filled.Search),
    Map(R.string.tab_map, Icons.Filled.LocationOn),
    Favourites(R.string.tab_favourites, Icons.Filled.Favorite),
}
