package com.calorie.tracker

import android.app.Application
import com.calorie.tracker.data.local.ReferenceFoodDb
import com.calorie.tracker.data.local.SessionStore

class App : Application() {
    lateinit var sessionStore: SessionStore
        private set
    lateinit var referenceFoodDb: ReferenceFoodDb
        private set

    override fun onCreate() {
        super.onCreate()
        sessionStore = SessionStore(this)
        referenceFoodDb = ReferenceFoodDb.get(this)
    }
}
