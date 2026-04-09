package com.calorie.tracker.data.api

import com.calorie.tracker.BuildConfig
import com.calorie.tracker.data.model.RefreshRequest
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

enum class AuthEvent { SESSION_EXPIRED }

object ApiClient {
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    var accessToken: String? = null
    var refreshToken: String? = null

    private val _authEvents = MutableSharedFlow<AuthEvent>(extraBufferCapacity = 1)
    val authEvents = _authEvents.asSharedFlow()

    private var refreshing = false

    private val authInterceptor = Interceptor { chain ->
        val builder = chain.request().newBuilder()
        accessToken?.let { builder.addHeader("Authorization", "Bearer $it") }
        val response = chain.proceed(builder.build())

        if (response.code == 401 && !chain.request().url.encodedPath.contains("/auth/")) {
            response.close()
            synchronized(this) {
                if (!refreshing) {
                    refreshing = true
                    val refreshed = tryRefreshToken()
                    refreshing = false
                    if (!refreshed) {
                        _authEvents.tryEmit(AuthEvent.SESSION_EXPIRED)
                        return@Interceptor response.newBuilder().code(401).build()
                    }
                }
            }
            val retryRequest = chain.request().newBuilder()
                .header("Authorization", "Bearer ${accessToken ?: ""}")
                .build()
            return@Interceptor chain.proceed(retryRequest)
        }

        response
    }

    private fun tryRefreshToken(): Boolean {
        val rt = refreshToken ?: return false
        return try {
            val call = auth.refreshSync(RefreshRequest(rt))
            val resp = call.execute()
            if (resp.isSuccessful && resp.body() != null) {
                val body = resp.body()!!
                accessToken = body.accessToken
                body.refreshToken?.let { refreshToken = it }
                onTokenRefreshed?.invoke(body.accessToken, body.refreshToken)
                true
            } else {
                accessToken = null
                refreshToken = null
                false
            }
        } catch (_: Exception) {
            false
        }
    }

    var onTokenRefreshed: ((accessToken: String, refreshToken: String?) -> Unit)? = null

    private val client = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY
            else HttpLoggingInterceptor.Level.NONE
        })
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
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
