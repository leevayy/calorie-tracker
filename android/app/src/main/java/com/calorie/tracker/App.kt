package com.calorie.tracker

import android.app.Application
import com.calorie.tracker.data.local.SessionStore

class App : Application() {
    lateinit var sessionStore: SessionStore
        private set

    override fun onCreate() {
        super.onCreate()
        sessionStore = SessionStore(this)
    }
}
