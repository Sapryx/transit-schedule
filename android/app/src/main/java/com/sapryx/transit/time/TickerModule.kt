package com.sapryx.transit.time

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.flow
import kotlin.time.Duration.Companion.seconds

@Module
@InstallIn(SingletonComponent::class)
object TickerModule {
    @Provides
    fun ticker(): Ticker = Ticker {
        flow {
            while (true) {
                delay(30.seconds)
                emit(Unit)
            }
        }
    }
}
