package com.sapryx.transit.network

import com.sapryx.transit.BuildConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl

@Module
@InstallIn(SingletonComponent::class)
object ApiBaseUrlModule {
    @Provides
    fun baseUrl(): HttpUrl = BuildConfig.API_BASE_URL.toHttpUrl()
}
