package com.sapryx.transit.ui

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.SerializationException
import retrofit2.HttpException
import java.io.IOException

sealed interface LoadState<out T> {
    data object Loading : LoadState<Nothing>

    data class Content<T>(val value: T) : LoadState<T>

    data object Error : LoadState<Nothing>
}

class Loadable<T>(private val scope: CoroutineScope, private val fetch: suspend () -> T) {
    private val mutableState = MutableStateFlow<LoadState<T>>(LoadState.Loading)
    val state: StateFlow<LoadState<T>> = mutableState.asStateFlow()

    private var job: Job? = null

    init {
        load()
    }

    fun load() {
        mutableState.value = LoadState.Loading
        refresh()
    }

    fun refresh() {
        job?.cancel()
        job = scope.launch {
            mutableState.value = try {
                LoadState.Content(fetch())
            } catch (_: IOException) {
                LoadState.Error
            } catch (_: HttpException) {
                LoadState.Error
            } catch (_: SerializationException) {
                LoadState.Error
            }
        }
    }
}
