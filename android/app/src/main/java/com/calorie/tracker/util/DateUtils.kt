package com.calorie.tracker.util

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private const val BEHAVIORAL_DAY_START_HOUR = 4

fun localIsoDate(date: LocalDate = LocalDate.now()): String =
    date.format(DateTimeFormatter.ISO_LOCAL_DATE)

/** Before this local hour, "today" for logging/tips is the previous calendar day. */
fun behavioralLocalIsoDate(dateTime: LocalDateTime = LocalDateTime.now()): String {
    val effectiveDate =
        if (dateTime.hour < BEHAVIORAL_DAY_START_HOUR) dateTime.toLocalDate().minusDays(1)
        else dateTime.toLocalDate()
    return localIsoDate(effectiveDate)
}

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
