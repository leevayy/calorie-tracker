/**
 * Drives parseFoodTextWithAi against analytics/trainingData.json and writes
 * analytics/runs/<YYYY-MM-DD>/<model>.json for offline analysis.
 *
 * Run from repo: npm run benchmark:parse-food --workspace calorie-tracker-backend
 * Or: cd backend && npm run benchmark:parse-food
 * Loads backend/.env via Node's --env-file (see package.json script).
 *
 * CLI:
 *   --debug — first 2 training rows only; default models qwen3 + alicegpt (override with --models)
 *   --models deepseek,qwen3,gptoss,alicegpt (full run default: all)
 *   --language ru | --nutrition-goal maintain | --delay-ms 0
 *
 * Full run: npm run benchmark:parse-food
 * Quick check: npm run benchmark:parse-food -- --debug
 *
 * After a run: cd ../analytics && npm run analyze -- <YYYY-MM-DD> [subfolder]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import type { AiModelPreference, NutritionGoal, PreferredLanguage } from "../src/contracts/common.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, "..");
const repoRoot = resolve(backendRoot, "..");

/** Keep in sync with `contracts/common.ts` `AiModelPreferenceSchema`. */
// const ALL_MODELS = ["deepseek", "qwen3", "gptoss", "alicegpt"] as const satisfies readonly AiModelPreference[];
const ALL_MODELS = ["qwen3", "alicegpt"] as const satisfies readonly AiModelPreference[];

/** With `--debug`, only this many training rows are used. */
const DEBUG_ROW_LIMIT = 2;

/** With `--debug` and no `--models`, these defaults keep the run short. */
const DEBUG_DEFAULT_MODELS = ["qwen3", "alicegpt"] as const satisfies readonly AiModelPreference[];

const PREFERRED_LANGUAGES = ["en", "ru", "pl", "tt", "kk"] as const satisfies readonly PreferredLanguage[];

const NUTRITION_GOALS = ["maintain", "muscle_gain", "fat_loss", "recomposition"] as const satisfies readonly NutritionGoal[];

function isAiModelPreference(s: string): s is AiModelPreference {
  return (ALL_MODELS as readonly string[]).includes(s);
}

function isPreferredLanguage(s: string): s is PreferredLanguage {
  return (PREFERRED_LANGUAGES as readonly string[]).includes(s);
}

function isNutritionGoal(s: string): s is NutritionGoal {
  return (NUTRITION_GOALS as readonly string[]).includes(s);
}

type TrainingRow = {
  query: string;
  expectedResult: { calories: number; protein: number };
};

function roundMs(ms: number): number {
  return Math.round(ms * 100) / 100;
}

function summarizeParseDurations(durationMsList: number[]) {
  if (!durationMsList.length) return null;
  const sorted = [...durationMsList].sort((a, b) => a - b);
  const total = durationMsList.reduce((s, x) => s + x, 0);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return {
    rowCount: durationMsList.length,
    totalMs: roundMs(total),
    avgMs: roundMs(total / durationMsList.length),
    minMs: roundMs(sorted[0]!),
    maxMs: roundMs(sorted[sorted.length - 1]!),
    medianMs: roundMs(median),
  };
}

function parseArgs(argv: string[]) {
  let models: AiModelPreference[] = [...ALL_MODELS];
  let modelsFromCli = false;
  let debug = false;
  let language: PreferredLanguage = "ru";
  let nutritionGoal: NutritionGoal = "maintain";
  let delayMs = 0;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--debug") {
      debug = true;
    } else if (a === "--models" && argv[i + 1]) {
      modelsFromCli = true;
      const raw = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
      models = [];
      for (const m of raw) {
        if (!isAiModelPreference(m)) {
          console.error(`Unknown model: ${m}. Expected one of: ${ALL_MODELS.join(", ")}`);
          process.exit(1);
        }
        models.push(m);
      }
    } else if (a === "--language" && argv[i + 1]) {
      const v = argv[++i];
      if (!isPreferredLanguage(v)) {
        console.error(`Invalid --language: ${v}. Expected one of: ${PREFERRED_LANGUAGES.join(", ")}`);
        process.exit(1);
      }
      language = v;
    } else if (a === "--nutrition-goal" && argv[i + 1]) {
      const v = argv[++i];
      if (!isNutritionGoal(v)) {
        console.error(`Invalid --nutrition-goal: ${v}. Expected one of: ${NUTRITION_GOALS.join(", ")}`);
        process.exit(1);
      }
      nutritionGoal = v;
    } else if (a === "--delay-ms" && argv[i + 1]) {
      delayMs = Math.max(0, Number(argv[++i]) || 0);
    }
  }

  if (debug && !modelsFromCli) {
    models = [...DEBUG_DEFAULT_MODELS];
  }

  return { models, language, nutritionGoal, delayMs, debug };
}

function localDateYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { models, language, nutritionGoal, delayMs, debug } = parseArgs(process.argv.slice(2));
  const trainingPath = resolve(repoRoot, "analytics", "trainingData.json");
  console.log("parse-food-benchmark: loading training data…");
  let trainingRows = JSON.parse(await readFile(trainingPath, "utf8")) as TrainingRow[];

  if (debug) {
    trainingRows = trainingRows.slice(0, DEBUG_ROW_LIMIT);
    console.log(`parse-food-benchmark: DEBUG — using first ${trainingRows.length} row(s), output under runs/<date>/debug/`);
  }

  console.log("parse-food-benchmark: loading AI module (validates env)…");
  const { parseFoodTextWithAi, buildNutritionParserSystem } = await import("../src/services/ai.ts");
  const systemPrompt = buildNutritionParserSystem(language, nutritionGoal);
  const runDate = localDateYmd();
  const outDir = debug
    ? resolve(repoRoot, "analytics", "runs", runDate, "debug")
    : resolve(repoRoot, "analytics", "runs", runDate);
  await mkdir(outDir, { recursive: true });

  console.log(
    `parse-food-benchmark: ${trainingRows.length} rows × ${models.length} model(s) → ${outDir.replace(/\\/g, "/")}`,
  );
  console.log(
    `  mode: ${debug ? "debug" : "full"} | models: ${models.join(", ")} | language: ${language} | nutritionGoal: ${nutritionGoal} | delayMs: ${delayMs}`,
  );

  const meta = {
    language,
    nutritionGoal,
    trainingDataPath: trainingPath.replace(/\\/g, "/"),
    createdAtIso: new Date().toISOString(),
    ...(debug ? { debug: true as const, debugRowLimit: DEBUG_ROW_LIMIT } : {}),
  };

  for (const model of models) {
    console.log(`\n── model: ${model} ──`);
    const results: Array<{
      query: string;
      expectedResult: { calories: number; protein: number };
      suggestions: Awaited<ReturnType<typeof parseFoodTextWithAi>>;
      error?: string;
      /** Wall time for parseFoodTextWithAi (ms), including failed attempts. */
      durationMs: number;
    }> = [];

    for (let i = 0; i < trainingRows.length; i++) {
      const row = trainingRows[i]!;
      const preview = row.query.length > 56 ? `${row.query.slice(0, 56)}…` : row.query;
      console.log(`  [${i + 1}/${trainingRows.length}] ${preview}`);
      const t0 = performance.now();
      try {
        const suggestions = await parseFoodTextWithAi(
          row.query,
          language,
          nutritionGoal,
          model,
          { skipCache: true },
        );
        const durationMs = roundMs(performance.now() - t0);
        console.log(`    → ${durationMs} ms`);
        results.push({
          query: row.query,
          expectedResult: row.expectedResult,
          suggestions,
          durationMs,
        });
      } catch (e) {
        const durationMs = roundMs(performance.now() - t0);
        const message = e instanceof Error ? e.message : String(e);
        console.log(`    → error (${durationMs} ms): ${message}`);
        results.push({
          query: row.query,
          expectedResult: row.expectedResult,
          suggestions: [],
          error: message,
          durationMs,
        });
      }
      if (delayMs > 0) await sleep(delayMs);
    }

    const timingSummary = summarizeParseDurations(results.map((r) => r.durationMs));
    if (timingSummary) {
      console.log(
        `  timing summary: avg ${timingSummary.avgMs} ms · median ${timingSummary.medianMs} ms · min–max ${timingSummary.minMs}–${timingSummary.maxMs} ms · total ${timingSummary.totalMs} ms`,
      );
    }

    const payload = {
      systemPrompt,
      meta,
      timingSummary,
      results,
    };

    const outFile = resolve(outDir, `${model}.json`);
    await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`Wrote ${outFile.replace(/\\/g, "/")}`);
  }

  console.log("\nparse-food-benchmark: done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
