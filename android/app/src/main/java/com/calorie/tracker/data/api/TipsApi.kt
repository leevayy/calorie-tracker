package com.calorie.tracker.data.api

import com.calorie.tracker.data.model.DailyTipRequest
import com.calorie.tracker.data.model.DailyTipResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface TipsApi {
    @POST("api/v1/tips/daily")
    suspend fun getDailyTip(@Body body: DailyTipRequest): Response<DailyTipResponse>
}
