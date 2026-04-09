package com.calorie.tracker.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.calorie.tracker.data.api.ApiClient
import com.calorie.tracker.data.local.SessionStore
import com.calorie.tracker.data.model.LoginRequest
import com.calorie.tracker.data.model.RegisterRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val isLogin: Boolean = true,
    val email: String = "",
    val password: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val success: Boolean = false
)

class AuthViewModel(private val sessionStore: SessionStore) : ViewModel() {
    private val _state = MutableStateFlow(AuthUiState())
    val state = _state.asStateFlow()

    fun setEmail(v: String) { _state.value = _state.value.copy(email = v, error = null) }
    fun setPassword(v: String) { _state.value = _state.value.copy(password = v, error = null) }
    fun toggleMode() { _state.value = _state.value.copy(isLogin = !_state.value.isLogin, error = null) }

    fun submit() {
        val s = _state.value
        if (s.email.isBlank() || s.password.isBlank()) return
        _state.value = s.copy(loading = true, error = null)
        viewModelScope.launch {
            try {
                val response = if (s.isLogin) {
                    ApiClient.auth.login(LoginRequest(s.email.trim(), s.password))
                } else {
                    ApiClient.auth.register(RegisterRequest(s.email.trim(), s.password))
                }
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    sessionStore.save(body.accessToken, body.refreshToken, body.user.id, body.user.email)
                    _state.value = _state.value.copy(loading = false, success = true)
                } else {
                    val msg = when (response.code()) {
                        401 -> "Invalid email or password"
                        409 -> "Email already registered"
                        400 -> "Invalid input"
                        else -> "Request failed"
                    }
                    _state.value = _state.value.copy(loading = false, error = msg)
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(loading = false, error = "Network error")
            }
        }
    }
}
