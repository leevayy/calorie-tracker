package com.calorie.tracker.data.api

import com.calorie.tracker.data.model.AuthResponse
import com.calorie.tracker.data.model.LoginRequest
import com.calorie.tracker.data.model.RefreshRequest
import com.calorie.tracker.data.model.RegisterRequest
import retrofit2.Call
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface AuthApi {
    @POST("api/v1/auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<AuthResponse>

    @POST("api/v1/auth/login")
    suspend fun login(@Body body: LoginRequest): Response<AuthResponse>

    @POST("api/v1/auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): Response<AuthResponse>

    @POST("api/v1/auth/refresh")
    fun refreshSync(@Body body: RefreshRequest): Call<AuthResponse>
}
