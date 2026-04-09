package com.calorie.tracker.data.api

import com.calorie.tracker.data.model.ParseFoodRequest
import com.calorie.tracker.data.model.ParseFoodResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface AiFoodApi {
    @POST("api/v1/ai/parse-food")
    suspend fun parseFood(@Body body: ParseFoodRequest): Response<ParseFoodResponse>
}
