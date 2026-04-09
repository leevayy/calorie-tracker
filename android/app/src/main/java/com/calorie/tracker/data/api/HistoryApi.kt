package com.calorie.tracker.data.api

import com.calorie.tracker.data.model.HistoryRangeResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

interface HistoryApi {
    @GET("api/v1/history")
    suspend fun getHistory(
        @Query("from") from: String,
        @Query("to") to: String
    ): Response<HistoryRangeResponse>
}
