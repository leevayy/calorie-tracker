package com.calorie.tracker.util

import com.calorie.tracker.data.local.ReferenceFoodEntity
import kotlin.math.ln
import kotlin.math.sqrt

object FoodSearchEngine {

    fun findTopMatches(
        query: String,
        foods: List<ReferenceFoodEntity>,
        limit: Int = 20
    ): List<ReferenceFoodEntity> {
        if (foods.isEmpty() || query.isBlank()) return foods.take(limit)
        val q = query.lowercase().trim()

        val bm25Scores = bm25Score(q, foods)
        val ngramScores = ngramCosineScores(q, foods)

        val combined = foods.mapIndexed { i, food ->
            val b = bm25Scores.getOrElse(i) { 0.0 }
            val n = ngramScores.getOrElse(i) { 0.0 }
            food to (0.4 * normalize(b, bm25Scores) + 0.6 * n)
        }

        return combined
            .sortedByDescending { it.second }
            .take(limit)
            .map { it.first }
    }

    private fun normalize(value: Double, all: List<Double>): Double {
        val max = all.maxOrNull() ?: return 0.0
        return if (max > 0.0) value / max else 0.0
    }

    private fun tokenize(text: String): List<String> =
        text.lowercase().split(Regex("[\\s,;.!?()]+")).filter { it.isNotBlank() }

    private fun bm25Score(
        query: String,
        docs: List<ReferenceFoodEntity>,
        k1: Double = 1.5,
        b: Double = 0.75
    ): List<Double> {
        val queryTerms = tokenize(query)
        val docTokens = docs.map { tokenize(it.name) }
        val avgDl = docTokens.map { it.size.toDouble() }.average().coerceAtLeast(1.0)
        val n = docs.size.toDouble()

        val df = mutableMapOf<String, Int>()
        docTokens.forEach { tokens ->
            tokens.toSet().forEach { t -> df[t] = (df[t] ?: 0) + 1 }
        }

        return docTokens.map { tokens ->
            val dl = tokens.size.toDouble()
            val tf = mutableMapOf<String, Int>()
            tokens.forEach { t -> tf[t] = (tf[t] ?: 0) + 1 }

            queryTerms.sumOf { qt ->
                val termDf = df[qt] ?: 0
                val termTf = tf[qt] ?: 0
                if (termDf == 0 || termTf == 0) 0.0
                else {
                    val idf = ln((n - termDf + 0.5) / (termDf + 0.5) + 1.0)
                    val tfNorm = (termTf * (k1 + 1)) / (termTf + k1 * (1 - b + b * dl / avgDl))
                    idf * tfNorm
                }
            }
        }
    }

    private fun charNgrams(text: String, n: Int = 3): Map<String, Int> {
        val padded = " ${text.lowercase()} "
        val grams = mutableMapOf<String, Int>()
        for (i in 0..padded.length - n) {
            val gram = padded.substring(i, i + n)
            grams[gram] = (grams[gram] ?: 0) + 1
        }
        return grams
    }

    private fun cosineSimilarity(a: Map<String, Int>, b: Map<String, Int>): Double {
        val keys = a.keys.intersect(b.keys)
        if (keys.isEmpty()) return 0.0
        val dot = keys.sumOf { (a[it] ?: 0).toLong() * (b[it] ?: 0).toLong() }.toDouble()
        val magA = sqrt(a.values.sumOf { it.toLong() * it.toLong() }.toDouble())
        val magB = sqrt(b.values.sumOf { it.toLong() * it.toLong() }.toDouble())
        return if (magA > 0 && magB > 0) dot / (magA * magB) else 0.0
    }

    private fun ngramCosineScores(query: String, docs: List<ReferenceFoodEntity>): List<Double> {
        val qGrams = charNgrams(query)
        return docs.map { cosineSimilarity(qGrams, charNgrams(it.name)) }
    }
}
