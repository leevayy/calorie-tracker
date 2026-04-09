package com.calorie.tracker.data.model

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class RegisterRequest(val email: String, val password: String)

@Serializable
data class RefreshRequest(val refreshToken: String)

@Serializable
data class UserSummary(val id: String, val email: String)

@Serializable
data class AuthResponse(
    val accessToken: String,
    val refreshToken: String? = null,
    val expiresInSeconds: Int? = null,
    val user: UserSummary
)
