-keepattributes *Annotation*
-keep class kotlinx.serialization.** { *; }
-keepclassmembers class * {
    @kotlinx.serialization.Serializable *;
}
-keep class com.calorie.tracker.data.model.** { *; }
-dontwarn okhttp3.**
-dontwarn retrofit2.**
