package com.calorie.tracker.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.calorie.tracker.data.api.ApiClient
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking

private val Context.dataStore by preferencesDataStore(name = "session")

class SessionStore(private val context: Context) {
    private val accessTokenKey = stringPreferencesKey("access_token")
    private val refreshTokenKey = stringPreferencesKey("refresh_token")
    private val userIdKey = stringPreferencesKey("user_id")
    private val userEmailKey = stringPreferencesKey("user_email")

    suspend fun save(accessToken: String, refreshToken: String?, userId: String, email: String) {
        context.dataStore.edit { prefs ->
            prefs[accessTokenKey] = accessToken
            refreshToken?.let { prefs[refreshTokenKey] = it }
            prefs[userIdKey] = userId
            prefs[userEmailKey] = email
        }
        ApiClient.accessToken = accessToken
        ApiClient.refreshToken = refreshToken
    }

    suspend fun restore(): Boolean {
        val prefs = context.dataStore.data.first()
        val token = prefs[accessTokenKey] ?: return false
        val rt = prefs[refreshTokenKey]
        ApiClient.accessToken = token
        ApiClient.refreshToken = rt
        return true
    }

    fun setupRefreshCallback() {
        ApiClient.onTokenRefreshed = { newAccess, newRefresh ->
            runBlocking {
                context.dataStore.edit { prefs ->
                    prefs[accessTokenKey] = newAccess
                    newRefresh?.let { prefs[refreshTokenKey] = it }
                }
            }
        }
    }

    suspend fun getAccessToken(): String? =
        context.dataStore.data.first()[accessTokenKey]

    suspend fun getRefreshToken(): String? =
        context.dataStore.data.first()[refreshTokenKey]

    suspend fun getUserEmail(): String? =
        context.dataStore.data.first()[userEmailKey]

    val isLoggedIn = context.dataStore.data.map { it[accessTokenKey] != null }

    suspend fun clear() {
        context.dataStore.edit { it.clear() }
        ApiClient.accessToken = null
        ApiClient.refreshToken = null
    }
}
