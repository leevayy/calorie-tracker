-keepattributes *Annotation*
-keep class kotlinx.serialization.** { *; }
-keepclassmembers class * {
    @kotlinx.serialization.Serializable *;
}
-keep class com.calorie.tracker.data.model.** { *; }
-keep class com.calorie.tracker.data.local.** { *; }
-dontwarn okhttp3.**
-dontwarn retrofit2.**
