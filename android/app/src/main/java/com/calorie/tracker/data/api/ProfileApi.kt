package com.calorie.tracker.data.api

import com.calorie.tracker.data.model.UpdateProfileRequest
import com.calorie.tracker.data.model.UserProfileResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH

interface ProfileApi {
    @GET("api/v1/me")
    suspend fun getProfile(): Response<UserProfileResponse>

    @PATCH("api/v1/me")
    suspend fun updateProfile(@Body body: UpdateProfileRequest): Response<UserProfileResponse>
}
