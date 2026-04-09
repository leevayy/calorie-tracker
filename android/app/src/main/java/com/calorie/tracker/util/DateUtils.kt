package com.calorie.tracker.util

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

fun localIsoDate(date: LocalDate = LocalDate.now()): String =
    date.format(DateTimeFormatter.ISO_LOCAL_DATE)

fun localTimeHm(): String {
    val now = LocalTime.now()
    return "%02d:%02d".format(now.hour, now.minute)
}

fun browserTimeZone(): String =
    ZoneId.systemDefault().id

fun defaultMealTypeForLocalTime(): String {
    val h = LocalTime.now().hour
    return when {
        h in 5..10 -> "breakfast"
        h in 11..15 -> "lunch"
        h in 16..21 -> "dinner"
        else -> "snack"
    }
}

fun weekRangeEndingOn(endIso: String): Pair<String, String> {
    val end = LocalDate.parse(endIso)
    val start = end.minusDays(6)
    return localIsoDate(start) to endIso
}

fun parseIsoDate(iso: String): LocalDate = LocalDate.parse(iso)
