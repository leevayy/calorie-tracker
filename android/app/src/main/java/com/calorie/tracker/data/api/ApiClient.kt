package com.calorie.tracker.data.api

import com.calorie.tracker.BuildConfig
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

object ApiClient {
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    var accessToken: String? = null

    private val authInterceptor = Interceptor { chain ->
        val builder = chain.request().newBuilder()
        accessToken?.let { builder.addHeader("Authorization", "Bearer $it") }
        chain.proceed(builder.build())
    }

    private val client = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY
            else HttpLoggingInterceptor.Level.NONE
        })
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL.ifEmpty { "http://localhost/" })
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    val auth: AuthApi = retrofit.create(AuthApi::class.java)
    val profile: ProfileApi = retrofit.create(ProfileApi::class.java)
    val foodLog: FoodLogApi = retrofit.create(FoodLogApi::class.java)
    val history: HistoryApi = retrofit.create(HistoryApi::class.java)
    val tips: TipsApi = retrofit.create(TipsApi::class.java)
    val aiFood: AiFoodApi = retrofit.create(AiFoodApi::class.java)
}
