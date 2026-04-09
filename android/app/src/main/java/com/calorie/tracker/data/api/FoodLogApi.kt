package com.calorie.tracker.data.api

import com.calorie.tracker.data.model.CreateFoodEntryBody
import com.calorie.tracker.data.model.DayLogResponse
import com.calorie.tracker.data.model.FoodEntryResponse
import com.calorie.tracker.data.model.FrequentFoodsResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface FoodLogApi {
    @GET("api/v1/days/{day}")
    suspend fun getDayLog(@Path("day") day: String): Response<DayLogResponse>

    @POST("api/v1/days/{day}/entries")
    suspend fun createEntry(
        @Path("day") day: String,
        @Body body: CreateFoodEntryBody
    ): Response<FoodEntryResponse>

    @DELETE("api/v1/entries/{entryId}")
    suspend fun deleteEntry(@Path("entryId") entryId: String): Response<Unit>

    @GET("api/v1/frequent-foods")
    suspend fun getFrequentFoods(
        @Query("from") from: String,
        @Query("to") to: String,
        @Query("limit") limit: Int = 3
    ): Response<FrequentFoodsResponse>
}
