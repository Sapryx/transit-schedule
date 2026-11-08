package com.sapryx.transit.stops

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import retrofit2.create

@Module
@InstallIn(SingletonComponent::class)
object StopsModule {
    @Provides
    fun stopsApi(retrofit: Retrofit): StopsApi = retrofit.create()
}
