package com.sapryx.transit.routes

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import retrofit2.create

@Module
@InstallIn(SingletonComponent::class)
object RoutesModule {
    @Provides
    fun routesApi(retrofit: Retrofit): RoutesApi = retrofit.create()
}
