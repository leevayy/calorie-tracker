package com.calorie.tracker.data.local

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Delete
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "reference_foods")
data class ReferenceFoodEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val calories: Double,
    val protein: Double,
    val carbs: Double,
    val fats: Double,
    val portion: String
)

@Dao
interface ReferenceFoodDao {
    @Query("SELECT * FROM reference_foods ORDER BY id DESC")
    fun getAll(): Flow<List<ReferenceFoodEntity>>

    @Query("SELECT * FROM reference_foods")
    suspend fun getAllSync(): List<ReferenceFoodEntity>

    @Insert
    suspend fun insert(food: ReferenceFoodEntity)

    @Delete
    suspend fun delete(food: ReferenceFoodEntity)
}

@Database(entities = [ReferenceFoodEntity::class], version = 1, exportSchema = false)
abstract class ReferenceFoodDb : RoomDatabase() {
    abstract fun dao(): ReferenceFoodDao

    companion object {
        @Volatile private var instance: ReferenceFoodDb? = null

        fun get(context: Context): ReferenceFoodDb =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    ReferenceFoodDb::class.java,
                    "reference_foods.db"
                ).build().also { instance = it }
            }
    }
}
