package com.sapryx.transit.calendar

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import retrofit2.create

@Module
@InstallIn(SingletonComponent::class)
object CalendarModule {
    @Provides
    fun calendarApi(retrofit: Retrofit): CalendarApi = retrofit.create()
}
