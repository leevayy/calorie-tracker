package com.calorie.tracker.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.calorie.tracker.data.api.ApiClient
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

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
    }

    suspend fun restore(): Boolean {
        val prefs = context.dataStore.data.first()
        val token = prefs[accessTokenKey] ?: return false
        ApiClient.accessToken = token
        return true
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
    }
}
