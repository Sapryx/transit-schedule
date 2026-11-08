package com.sapryx.transit.journeys

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import retrofit2.create

@Module
@InstallIn(SingletonComponent::class)
object JourneysModule {
    @Provides
    fun journeysApi(retrofit: Retrofit): JourneysApi = retrofit.create()
}
