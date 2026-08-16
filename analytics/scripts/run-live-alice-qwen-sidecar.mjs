import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");
const fdcPath = resolve(
  repoRoot,
  "tmp/prompt-investigation/usda/foundation/FoodData_Central_foundation_food_json_2026-04-30.json",
);
const searchDir = resolve(
  repoRoot,
  "analytics/runs/2026-08-16-prompt-investigation",
);
const outputDir = resolve(
  repoRoot,
  "analytics/runs/2026-08-17-alice-qwen-sidecar",
);

const timing = {
  localDate: "2026-08-16",
  localTimeHm: "12:00",
  clientTimeZone: "Europe/Moscow",
  defaultLogDay: "2026-08-16",
  defaultMealType: "lunch",
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const requiredLiveEnvironment = [
  "YANDEX_AI_STUDIO_API_KEY",
  "YANDEX_FOLDER_ID",
  "SIDECAR_EXPECTED_ALICE_MODEL_ID",
  "SIDECAR_EXPECTED_ENDPOINT_HOST",
];

if (!dryRun) {
  for (const name of requiredLiveEnvironment) {
    if (!process.env[name]?.trim()) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
  }
}

const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");

function round(value, digits = 3) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function percentile(values, probability) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return (
    sorted[lower] +
    (sorted[upper] - sorted[lower]) * (index - lower)
  );
}

const nutrientNames = new Set([
  "calories",
  "protein",
  "fat",
  "carbohydrates",
  "fiber",
]);
const nutrientUnits = new Set(["kcal", "g"]);
const mealTypes = new Set(["breakfast", "lunch", "dinner", "snack"]);

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requireFiniteNonnegative(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite nonnegative number`);
  }
  return value;
}

function sanitizeMealSlug(raw) {
  const text = raw.trim();
  if (!text) return null;
  const lastToken = text.split(/\s+/).pop() ?? "";
  const cleaned = lastToken
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (
    !cleaned ||
    cleaned.length > 60 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleaned)
  ) {
    return null;
  }
  return cleaned;
}

/** Self-contained mirror of the deployed parse-food provider contract. */
function parseNutritionProviderResponse(raw, parseTiming) {
  if (typeof raw !== "string") throw new Error("AI response must be text");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI did not return JSON");

  const payload = requireObject(
    JSON.parse(raw.slice(start, end + 1)),
    "AI payload",
  );
  if (!Array.isArray(payload.foods)) {
    throw new Error("AI payload.foods must be an array");
  }
  if (payload.notes !== undefined && typeof payload.notes !== "string") {
    throw new Error("AI payload.notes must be a string when present");
  }

  return payload.foods.map((rawFood, foodIndex) => {
    const food = requireObject(rawFood, `foods[${foodIndex}]`);
    if (typeof food.name !== "string" || !food.name.trim()) {
      throw new Error(`foods[${foodIndex}].name must be a non-empty string`);
    }
    if (
      food.description !== undefined &&
      typeof food.description !== "string"
    ) {
      throw new Error(
        `foods[${foodIndex}].description must be a string when present`,
      );
    }
    if (
      food.estimated_portion !== undefined &&
      (typeof food.estimated_portion !== "string" ||
        food.estimated_portion.length < 1)
    ) {
      throw new Error(
        `foods[${foodIndex}].estimated_portion must be non-empty when present`,
      );
    }
    if (
      food.confidence !== undefined &&
      (typeof food.confidence !== "number" ||
        !Number.isFinite(food.confidence) ||
        food.confidence < 0 ||
        food.confidence > 1)
    ) {
      throw new Error(`foods[${foodIndex}].confidence must be between 0 and 1`);
    }
    if (food.meal_slug !== undefined && typeof food.meal_slug !== "string") {
      throw new Error(
        `foods[${foodIndex}].meal_slug must be a string when present`,
      );
    }
    if (
      food.log_day !== undefined &&
      !/^\d{4}-\d{2}-\d{2}$/.test(food.log_day)
    ) {
      throw new Error(`foods[${foodIndex}].log_day must use YYYY-MM-DD`);
    }
    if (food.meal_type !== undefined && !mealTypes.has(food.meal_type)) {
      throw new Error(`foods[${foodIndex}].meal_type is invalid`);
    }
    if (!Array.isArray(food.nutrients)) {
      throw new Error(`foods[${foodIndex}].nutrients must be an array`);
    }

    const nutrients = new Map();
    for (const [nutrientIndex, rawNutrient] of food.nutrients.entries()) {
      const item = requireObject(
        rawNutrient,
        `foods[${foodIndex}].nutrients[${nutrientIndex}]`,
      );
      if (!nutrientNames.has(item.name)) {
        throw new Error(
          `foods[${foodIndex}].nutrients[${nutrientIndex}].name is invalid`,
        );
      }
      if (!nutrientUnits.has(item.unit)) {
        throw new Error(
          `foods[${foodIndex}].nutrients[${nutrientIndex}].unit is invalid`,
        );
      }
      const amount = requireFiniteNonnegative(
        item.amount,
        `foods[${foodIndex}].nutrients[${nutrientIndex}].amount`,
      );
      if (!nutrients.has(item.name)) nutrients.set(item.name, amount);
    }
    for (const requiredName of nutrientNames) {
      if (!nutrients.has(requiredName)) {
        throw new Error(
          `foods[${foodIndex}] is missing required nutrient ${requiredName}`,
        );
      }
    }

    const description = food.description?.trim();
    const slug =
      typeof food.meal_slug === "string"
        ? sanitizeMealSlug(food.meal_slug)
        : null;
    return {
      name: food.name.trim(),
      ...(description ? { description } : {}),
      ...(food.confidence !== undefined
        ? { confidence: food.confidence }
        : {}),
      ...(slug ? { mealSlug: slug } : {}),
      calories: nutrients.get("calories"),
      protein: nutrients.get("protein"),
      carbs: nutrients.get("carbohydrates"),
      fats: nutrients.get("fat"),
      fiber: nutrients.get("fiber"),
      portion: food.estimated_portion ?? "1 serving",
      day: food.log_day ?? parseTiming.defaultLogDay,
      mealType: food.meal_type ?? parseTiming.defaultMealType,
    };
  });
}

function parserSelfTest() {
  const fixture = `preamble\n{"foods":[{"name":"Fixture","estimated_portion":"100 g","nutrients":[{"name":"calories","amount":123,"unit":"kcal"},{"name":"protein","amount":4.5,"unit":"g"},{"name":"fat","amount":2,"unit":"g"},{"name":"carbohydrates","amount":20,"unit":"g"},{"name":"fiber","amount":3,"unit":"g"}],"meal_slug":"fixture","log_day":"2026-08-16","meal_type":"lunch"}]}\nsuffix`;
  const [parsed] = parseNutritionProviderResponse(fixture, timing);
  if (
    parsed?.calories !== 123 ||
    parsed?.protein !== 4.5 ||
    parsed?.portion !== "100 g"
  ) {
    throw new Error("Provider contract mirror failed its valid startup fixture");
  }

  let rejectedMissingFiber = false;
  try {
    parseNutritionProviderResponse(
      fixture.replace(',{"name":"fiber","amount":3,"unit":"g"}', ""),
      timing,
    );
  } catch {
    rejectedMissingFiber = true;
  }
  if (!rejectedMissingFiber) {
    throw new Error("Provider contract mirror accepted an invalid fixture");
  }
}

function nutrient(food, id) {
  return food.foodNutrients?.find((item) => item?.nutrient?.id === id)?.amount;
}

function makeFoundationCases(raw) {
  const foods = raw.FoundationFoods.filter(Boolean)
    .map((food) => ({
      fdcId: food.fdcId,
      description: food.description,
      calories: nutrient(food, 1008),
      protein: nutrient(food, 1003),
      fats: nutrient(food, 1004),
      carbs: nutrient(food, 1005),
      fiber: nutrient(food, 1079),
    }))
    .filter(
      (food) => Number.isFinite(food.calories) && Number.isFinite(food.protein),
    )
    .sort((left, right) => left.fdcId - right.fdcId);

  if (foods.length > 100) {
    throw new Error(`Foundation run has ${foods.length} cases; maximum is 100`);
  }
  const templates = [
    (description) => `I ate exactly 100 g of ${description}.`,
    (description) => `Log 100 g of ${description}.`,
    (description) => `100 g of ${description}.`,
  ];
  return foods.map((food, index) => ({
    dataset: "fdc-primary",
    caseId: `fdc-${food.fdcId}`,
    sourceId: String(food.fdcId),
    query: templates[index % templates.length](food.description.toLowerCase()),
    description: food.description,
    expected: { calories: food.calories, protein: food.protein },
    reference: {
      calories: food.calories,
      protein: food.protein,
      ...(Number.isFinite(food.fats) ? { fats: food.fats } : {}),
      ...(Number.isFinite(food.carbs) ? { carbs: food.carbs } : {}),
      ...(Number.isFinite(food.fiber) ? { fiber: food.fiber } : {}),
    },
  }));
}

function assertExactCases(actualCases, frozenCases) {
  if (actualCases.length !== 95 || frozenCases.length !== 95) {
    throw new Error(
      `Expected exactly 95 Foundation cases; rebuilt=${actualCases.length}, frozen=${frozenCases.length}`,
    );
  }
  for (let index = 0; index < actualCases.length; index += 1) {
    const actual = actualCases[index];
    const frozen = frozenCases[index];
    if (JSON.stringify(actual) !== JSON.stringify(frozen)) {
      throw new Error(
        `Official Foundation case does not match frozen search case at index ${index}: ${actual.caseId}/${frozen?.caseId}`,
      );
    }
  }
}

function parseNdjson(text, label) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(
        `${label} line ${index + 1} is invalid JSON: ${error instanceof Error ? error.message : error}`,
      );
    }
  });
}

function validateFrozenQwenArtifact({ manifest, summary, cases, trials }) {
  if (
    typeof manifest.experimentId !== "string" ||
    !manifest.experimentId.trim()
  ) {
    throw new Error("Qwen search manifest is missing experimentId");
  }
  if (
    typeof manifest.productionModelPreference !== "string" ||
    !manifest.productionModelPreference.startsWith("qwen") ||
    typeof manifest.productionModelId !== "string" ||
    !manifest.productionModelId.trim() ||
    typeof manifest.endpointHost !== "string" ||
    !manifest.endpointHost.trim()
  ) {
    throw new Error(
      "Qwen search manifest is missing required Qwen route/model/endpoint metadata",
    );
  }
  if (manifest.repetitions !== 3) {
    throw new Error(`Qwen search repetitions must be 3, got ${manifest.repetitions}`);
  }
  const baselineVariant = manifest.variants?.find(
    (variant) => variant.id === "baseline",
  );
  if (
    baselineVariant?.kind !== "production-prompt" ||
    typeof baselineVariant.promptHash !== "string" ||
    typeof baselineVariant.promptTemplate !== "string"
  ) {
    throw new Error("Qwen search manifest has no complete baseline prompt metadata");
  }
  const frozenSummary = summary.datasets?.["fdc-primary"]?.variants?.baseline;
  if (
    !frozenSummary ||
    frozenSummary.trialCount !== 285 ||
    frozenSummary.successfulTrials !== 285 ||
    frozenSummary.completeCasesAcrossRepetitions !== 95 ||
    frozenSummary.eligible !== true
  ) {
    throw new Error("Frozen Qwen baseline is not a complete 95 x 3 arm");
  }

  const baselineTrials = trials.filter(
    (trial) => trial.dataset === "fdc-primary" && trial.variant === "baseline",
  );
  if (baselineTrials.length !== 285) {
    throw new Error(
      `Expected 285 frozen Qwen baseline trials, found ${baselineTrials.length}`,
    );
  }
  const casesById = new Map(cases.map((caseRow) => [caseRow.caseId, caseRow]));
  const seen = new Set();
  for (const trial of baselineTrials) {
    const caseRow = casesById.get(trial.caseId);
    if (!caseRow) throw new Error(`Unknown Qwen case ${trial.caseId}`);
    const key = `${trial.caseId}/${trial.repetition}`;
    if (seen.has(key)) throw new Error(`Duplicate Qwen trial ${key}`);
    seen.add(key);
    if (![1, 2, 3].includes(trial.repetition)) {
      throw new Error(`Invalid Qwen repetition for ${key}`);
    }
    if (
      trial.status !== "ok" ||
      trial.query !== caseRow.query ||
      JSON.stringify(trial.expected) !== JSON.stringify(caseRow.expected) ||
      trial.systemPromptHash !== baselineVariant.promptHash
    ) {
      throw new Error(`Frozen Qwen trial contract mismatch for ${key}`);
    }
  }
  if (seen.size !== 285) throw new Error("Frozen Qwen trial keys are incomplete");
  return { baselineVariant, baselineTrials, frozenSummary };
}

function resolveGitCommit() {
  if (process.env.EXPERIMENT_GIT_COMMIT?.trim()) {
    return process.env.EXPERIMENT_GIT_COMMIT.trim();
  }
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unavailable";
  }
}

function seededRandom(seedText) {
  let state = Number.parseInt(sha256(seedText).slice(0, 8), 16) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function shuffle(items, seed) {
  const random = seededRandom(seed);
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function bootstrapRatio(
  qwenByCase,
  aliceByCase,
  metric,
  seed,
  iterations = 10_000,
) {
  const caseIds = [...qwenByCase.keys()];
  if (
    caseIds.length !== 95 ||
    caseIds.some((caseId) => !aliceByCase.has(caseId))
  ) {
    return null;
  }
  const random = seededRandom(seed);
  const ratios = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let qwenError = 0;
    let aliceError = 0;
    for (let index = 0; index < caseIds.length; index += 1) {
      const caseId = caseIds[Math.floor(random() * caseIds.length)];
      qwenError += qwenByCase.get(caseId)[metric];
      aliceError += aliceByCase.get(caseId)[metric];
    }
    ratios.push(
      qwenError === 0
        ? aliceError === 0
          ? 0
          : Number.POSITIVE_INFINITY
        : aliceError / qwenError,
    );
  }
  return {
    lower95: round(percentile(ratios, 0.025)),
    upper95: round(percentile(ratios, 0.975)),
  };
}

async function callAlice(task, route) {
  const apiKey = process.env.YANDEX_AI_STUDIO_API_KEY;
  const authorization = apiKey.startsWith("AQVN")
    ? `Api-Key ${apiKey}`
    : `Bearer ${apiKey}`;
  const overallStarted = performance.now();
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let completion;
    let content;
    try {
      const response = await fetch(route.endpointUrl, {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          "x-folder-id": process.env.YANDEX_FOLDER_ID,
        },
        body: JSON.stringify({
          model: route.modelUri,
          messages: [
            { role: "system", content: task.systemPrompt },
            { role: "user", content: task.caseRow.query },
          ],
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(180_000),
      });
      const body = await response.text();
      if (!response.ok) {
        const message = `HTTP ${response.status}: ${body.slice(0, 300)}`;
        const retryable =
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500;
        if (retryable && attempt < 3) {
          lastError = new Error(message);
          await new Promise((resolveDelay) =>
            setTimeout(resolveDelay, 1_500 * attempt),
          );
          continue;
        }
        return {
          status: "error",
          errorStage: "transport-or-provider",
          providerResponseReceived: true,
          httpStatus: response.status,
          attemptCount: attempt,
          firstAttemptOk: false,
          latencyMs: round(performance.now() - overallStarted, 1),
          error: message,
        };
      }

      try {
        completion = JSON.parse(body);
        content = completion.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) {
          throw new Error("Empty model content");
        }
      } catch (error) {
        return {
          status: "error",
          errorStage: "provider-envelope",
          providerResponseReceived: true,
          attemptCount: attempt,
          firstAttemptOk: false,
          latencyMs: round(performance.now() - overallStarted, 1),
          rawProviderBody: body.slice(0, 10_000),
          error: error instanceof Error ? error.message : String(error),
        };
      }

      let suggestions;
      try {
        suggestions = parseNutritionProviderResponse(content, timing);
        if (!suggestions.length) {
          throw new Error("AI payload contained no food suggestions");
        }
      } catch (error) {
        return {
          status: "error",
          errorStage: "local-parser",
          providerResponseReceived: true,
          attemptCount: attempt,
          firstAttemptOk: false,
          latencyMs: round(performance.now() - overallStarted, 1),
          providerModel: completion.model ?? null,
          usage: completion.usage ?? null,
          rawContent: content,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      return {
        status: "ok",
        attemptCount: attempt,
        firstAttemptOk: attempt === 1,
        latencyMs: round(performance.now() - overallStarted, 1),
        providerModel: completion.model ?? null,
        usage: completion.usage ?? null,
        rawContent: content,
        suggestions,
        totals: {
          calories: round(
            suggestions.reduce((sum, suggestion) => sum + suggestion.calories, 0),
          ),
          protein: round(
            suggestions.reduce((sum, suggestion) => sum + suggestion.protein, 0),
          ),
        },
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolveDelay) =>
          setTimeout(resolveDelay, 1_500 * attempt),
        );
      }
    }
  }

  return {
    status: "error",
    errorStage: "transport-or-provider",
    providerResponseReceived: false,
    attemptCount: 3,
    firstAttemptOk: false,
    latencyMs: round(performance.now() - overallStarted, 1),
    error: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

async function runPool(tasks, concurrency, worker) {
  const results = new Array(tasks.length);
  let cursor = 0;
  let completed = 0;
  async function consume() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) return;
      results[index] = await worker(tasks[index]);
      completed += 1;
      if (completed % 25 === 0 || completed === tasks.length) {
        console.log(`progress ${completed}/${tasks.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => consume()));
  return results;
}

function createProviderFailureCircuit(threshold = 12) {
  let consecutiveFailures = 0;
  let open = false;
  return {
    assertClosed() {
      if (open) {
        throw new Error(
          "Provider failure circuit is open; aborting before additional paid requests",
        );
      }
    },
    record(outcome) {
      if (outcome.status === "error") {
        consecutiveFailures += 1;
        if (consecutiveFailures >= threshold) open = true;
      } else {
        consecutiveFailures = 0;
      }
    },
    snapshot() {
      return { threshold, consecutiveFailures, open };
    },
  };
}

function summarizeArm(trials, cases) {
  const successful = trials.filter((trial) => trial.status === "ok");
  const calorieErrors = successful.map((trial) =>
    Math.abs(trial.totals.calories - trial.expected.calories),
  );
  const proteinErrors = successful.map((trial) =>
    Math.abs(trial.totals.protein - trial.expected.protein),
  );
  const latencies = successful.map((trial) => trial.latencyMs);
  const byCase = new Map();
  for (const caseRow of cases) {
    const repeated = successful.filter(
      (trial) => trial.caseId === caseRow.caseId,
    );
    if (repeated.length !== 3) continue;
    byCase.set(caseRow.caseId, {
      calories: mean(
        repeated.map((trial) =>
          Math.abs(trial.totals.calories - trial.expected.calories),
        ),
      ),
      protein: mean(
        repeated.map((trial) =>
          Math.abs(trial.totals.protein - trial.expected.protein),
        ),
      ),
    });
  }
  const errorsByStage = {};
  for (const trial of trials.filter((trial) => trial.status === "error")) {
    const stage = trial.errorStage ?? "unknown";
    errorsByStage[stage] = (errorsByStage[stage] ?? 0) + 1;
  }
  return {
    metrics: {
      trialCount: trials.length,
      requestedOutputs: trials.length,
      successfulTrials: successful.length,
      scorableOutputs: successful.length,
      failedTrials: trials.length - successful.length,
      coveragePct: round((100 * successful.length) / trials.length),
      firstAttemptSuccessPct: round(
        (100 * trials.filter((trial) => trial.firstAttemptOk).length) /
          trials.length,
      ),
      completeCasesAcrossRepetitions: byCase.size,
      completeCoverage:
        trials.length === 285 &&
        successful.length === 285 &&
        byCase.size === cases.length,
      calorieMae: round(mean(calorieErrors)),
      proteinMae: round(mean(proteinErrors)),
      calorieMedianAbsoluteError: round(percentile(calorieErrors, 0.5)),
      calorieP90AbsoluteError: round(percentile(calorieErrors, 0.9)),
      proteinMedianAbsoluteError: round(percentile(proteinErrors, 0.5)),
      proteinP90AbsoluteError: round(percentile(proteinErrors, 0.9)),
      latencyMeanMs: round(mean(latencies), 1),
      latencyP50Ms: round(percentile(latencies, 0.5), 1),
      latencyP95Ms: round(percentile(latencies, 0.95), 1),
      totalProviderAttempts: trials.reduce(
        (sum, trial) => sum + (trial.attemptCount ?? 0),
        0,
      ),
      errorsByStage,
    },
    byCase,
  };
}

function pairedComparison(qwenArm, aliceArm) {
  const fullyObservedPairedCases = [...qwenArm.byCase.keys()].filter((caseId) =>
    aliceArm.byCase.has(caseId),
  ).length;
  const completeCoverage =
    qwenArm.metrics.completeCoverage && aliceArm.metrics.completeCoverage;
  if (!completeCoverage) {
    return {
      available: false,
      completeCoverage: false,
      fullyObservedPairedCases,
      requestedPairedCases: 95,
      reason:
        `The artifact is accepted, but the all-95-case paired ratio and confidence interval are not calculated: ${fullyObservedPairedCases}/95 cases have all three scorable Alice repetitions. Available-case Alice MAE is retained as descriptive. No failed row is deleted, formatting-retried, or imputed.`,
      calorie: null,
      protein: null,
      latency: null,
    };
  }
  const calorieRatio =
    aliceArm.metrics.calorieMae / qwenArm.metrics.calorieMae;
  const proteinRatio =
    aliceArm.metrics.proteinMae / qwenArm.metrics.proteinMae;
  return {
    available: true,
    completeCoverage: true,
    fullyObservedPairedCases,
    requestedPairedCases: 95,
    unit: "Alice divided by Qwen; values below 1 favor Alice",
    calorie: {
      maeRatio: round(calorieRatio),
      aliceReductionVsQwenPct: round(100 * (1 - calorieRatio)),
      ratioBootstrap95: bootstrapRatio(
        qwenArm.byCase,
        aliceArm.byCase,
        "calories",
        "alice-qwen-sidecar:calories",
      ),
    },
    protein: {
      maeRatio: round(proteinRatio),
      aliceReductionVsQwenPct: round(100 * (1 - proteinRatio)),
      ratioBootstrap95: bootstrapRatio(
        qwenArm.byCase,
        aliceArm.byCase,
        "protein",
        "alice-qwen-sidecar:protein",
      ),
    },
    latency: {
      p50Ratio: round(
        aliceArm.metrics.latencyP50Ms / qwenArm.metrics.latencyP50Ms,
      ),
      qwenToAliceP50Speedup: round(
        qwenArm.metrics.latencyP50Ms / aliceArm.metrics.latencyP50Ms,
      ),
      interpretation:
        "Descriptive cross-run ratio only: Alice latency is measured in this sidecar, while Qwen latency is reused from the earlier interleaved multi-arm search. This is not a controlled estimate of intrinsic model speed.",
    },
  };
}

function formatNumber(value, digits = 3) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "n/a";
}

function markdownSummary(summary) {
  const qwen = summary.arms.qwen.metrics;
  const alice = summary.arms.alice.metrics;
  const paired = summary.pairedComparison;
  const status = paired.available
    ? "Accepted - complete matched comparison"
    : "Accepted with Alice reliability errors - available-case metrics are descriptive";
  const calorieFinding = paired.available
    ? `Alice/Qwen calorie MAE ratio: ${formatNumber(paired.calorie.maeRatio)} (95% paired bootstrap ${formatNumber(paired.calorie.ratioBootstrap95.lower95)} to ${formatNumber(paired.calorie.ratioBootstrap95.upper95)}).`
    : paired.reason;
  const proteinFinding = paired.available
    ? `Alice/Qwen protein MAE ratio: ${formatNumber(paired.protein.maeRatio)} (95% paired bootstrap ${formatNumber(paired.protein.ratioBootstrap95.lower95)} to ${formatNumber(paired.protein.ratioBootstrap95.upper95)}).`
    : "Protein ratio and confidence interval are not estimated from incomplete arms.";
  const latencyFinding = paired.available
    ? `Alice p50 latency is descriptively ${formatNumber(paired.latency.p50Ratio)}x Qwen; equivalently the cross-run Qwen/Alice p50 ratio is ${formatNumber(paired.latency.qwenToAliceP50Speedup)}x.`
    : "Latency values remain descriptive; the all-case paired estimate stays unavailable.";

  return `# Alice vs Qwen production-routing sidecar

**Status:** ${status}

This is a matched routing diagnostic, not another prompt hypothesis. It sends the exact frozen production baseline prompt and the same 95 authentic USDA Foundation food-log messages to the live Alice route three times each (285 requests). The Qwen comparator is the already-frozen complete baseline arm; no Qwen calls are repeated.

## Route provenance

| Arm | Selector | Model ID | Endpoint host | Source |
|---|---|---|---|---|
| Qwen | ${summary.arms.qwen.route.preference} | ${summary.arms.qwen.route.modelId} | ${summary.arms.qwen.route.endpointHost} | frozen search artifact |
| Alice | ${summary.arms.alice.route.preference} | ${summary.arms.alice.route.modelId} | ${summary.arms.alice.route.endpointHost} | live production selector |

Both arms use temperature 0.1, the same production prompt hash, the same exact-100g user messages, the same response contract, and three repetitions per case.

## Results

| Metric | Qwen | Alice |
|---|---:|---:|
| Scorable / requested outputs | ${qwen.scorableOutputs}/${qwen.requestedOutputs} | ${alice.scorableOutputs}/${alice.requestedOutputs} |
| Complete cases across all repetitions | ${qwen.completeCasesAcrossRepetitions}/95 | ${alice.completeCasesAcrossRepetitions}/95 |
| Calorie MAE (kcal/100g) | ${formatNumber(qwen.calorieMae)} | ${formatNumber(alice.calorieMae)} |
| Protein MAE (g/100g) | ${formatNumber(qwen.proteinMae)} | ${formatNumber(alice.proteinMae)} |
| Latency p50 (ms) | ${formatNumber(qwen.latencyP50Ms, 1)} | ${formatNumber(alice.latencyP50Ms, 1)} |
| Latency p95 (ms) | ${formatNumber(qwen.latencyP95Ms, 1)} | ${formatNumber(alice.latencyP95Ms, 1)} |

## Paired finding

- ${calorieFinding}
- ${proteinFinding}
- ${latencyFinding}

The latency ratio is not a controlled intrinsic-speed comparison: Alice latency is measured now, while Qwen latency is reused from the earlier interleaved multi-arm search. Provider load and run context can differ.

## Interpretation boundary

The artifact is accepted even if Alice has model-format failures. In that case, Alice MAE is reported over the exact scorable/requested denominator as an available-case descriptive result, and the all-95-case paired ratio/CI is left null. Failed outputs remain reliability evidence; none are silently dropped, imputed, or re-requested after a local format failure.

The finding applies to this exact production prompt, route configuration, endpoint, dataset, and run date. It does not by itself prove that either model is universally better on mixed meals, free-form portions, other languages, or future model versions.
`;
}

async function main() {
  parserSelfTest();
  const [
    fdcText,
    searchManifestText,
    searchSummaryText,
    searchDatasetText,
    searchTrialsText,
  ] = await Promise.all([
    readFile(fdcPath, "utf8"),
    readFile(resolve(searchDir, "manifest.json"), "utf8"),
    readFile(resolve(searchDir, "summary.json"), "utf8"),
    readFile(resolve(searchDir, "dataset.json"), "utf8"),
    readFile(resolve(searchDir, "trials.ndjson"), "utf8"),
  ]);
  const cases = makeFoundationCases(JSON.parse(fdcText));
  const searchManifest = JSON.parse(searchManifestText);
  const searchSummary = JSON.parse(searchSummaryText);
  const searchDataset = JSON.parse(searchDatasetText);
  const searchTrials = parseNdjson(searchTrialsText, "search trials");
  assertExactCases(cases, searchDataset.primaryCases ?? []);
  const frozenQwen = validateFrozenQwenArtifact({
    manifest: searchManifest,
    summary: searchSummary,
    cases,
    trials: searchTrials,
  });
  const qwenArm = summarizeArm(frozenQwen.baselineTrials, cases);
  if (
    qwenArm.metrics.calorieMae !== frozenQwen.frozenSummary.calorieMae ||
    qwenArm.metrics.proteinMae !== frozenQwen.frozenSummary.proteinMae ||
    qwenArm.metrics.latencyP50Ms !== frozenQwen.frozenSummary.latencyP50Ms ||
    qwenArm.metrics.latencyP95Ms !== frozenQwen.frozenSummary.latencyP95Ms
  ) {
    throw new Error("Recomputed Qwen metrics do not match frozen search summary");
  }

  const [{ buildNutritionParserSystem }, modelModule] = await Promise.all([
    import("../../backend/src/services/ai.ts"),
    import("../../backend/src/services/aiModel.ts"),
  ]);
  if (
    typeof buildNutritionParserSystem !== "function" ||
    typeof modelModule.configuredAiModelId !== "function" ||
    typeof modelModule.configuredAiModelUri !== "function"
  ) {
    throw new Error("Required production prompt/model selector export is unavailable");
  }

  const baselinePrompt = buildNutritionParserSystem("en", "maintain", timing);
  const baselinePromptHash = sha256(baselinePrompt);
  if (
    baselinePrompt !== frozenQwen.baselineVariant.promptTemplate ||
    baselinePromptHash !== frozenQwen.baselineVariant.promptHash
  ) {
    throw new Error(
      "Live production baseline prompt no longer matches the frozen Qwen baseline; aborting before paid requests",
    );
  }

  const endpointUrl =
    process.env.YANDEX_AI_STUDIO_URL ||
    "https://ai.api.cloud.yandex.net/v1/chat/completions";
  const parsedEndpoint = new URL(endpointUrl);
  const endpointHost = parsedEndpoint.host;
  const endpoint = `${parsedEndpoint.origin}${parsedEndpoint.pathname}`;
  const alicePreference = "alicegpt";
  const aliceModelId = modelModule.configuredAiModelId(alicePreference);
  const aliceModelUri = modelModule.configuredAiModelUri(alicePreference);
  const expectedAliceModelId = process.env.SIDECAR_EXPECTED_ALICE_MODEL_ID?.trim();
  const expectedEndpointHost = process.env.SIDECAR_EXPECTED_ENDPOINT_HOST?.trim();
  if (expectedAliceModelId && expectedAliceModelId !== aliceModelId) {
    throw new Error(
      `Resolved Alice model changed before execution: expected ${expectedAliceModelId}, got ${aliceModelId}`,
    );
  }
  if (expectedEndpointHost && expectedEndpointHost !== endpointHost) {
    throw new Error(
      `Resolved endpoint changed before execution: expected ${expectedEndpointHost}, got ${endpointHost}`,
    );
  }
  if (endpointHost !== searchManifest.endpointHost) {
    throw new Error(
      `Alice endpoint host ${endpointHost} does not match frozen Qwen endpoint host ${searchManifest.endpointHost}; aborting unmatched comparison`,
    );
  }
  if (aliceModelId === searchManifest.productionModelId) {
    throw new Error(
      "The live alicegpt selector resolves to the frozen Qwen model ID; aborting a mislabeled comparison",
    );
  }

  const tasks = [];
  for (let repetition = 1; repetition <= 3; repetition += 1) {
    for (const caseRow of cases) {
      tasks.push({
        repetition,
        caseRow,
        systemPrompt: baselinePrompt,
        systemPromptHash: baselinePromptHash,
      });
    }
  }
  if (tasks.length !== 285) {
    throw new Error(`Expected 285 Alice tasks, found ${tasks.length}`);
  }
  const concurrency = Number(
    process.env.PROMPT_MODEL_SIDECAR_CONCURRENCY || 6,
  );
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    throw new Error(
      `PROMPT_MODEL_SIDECAR_CONCURRENCY must be an integer from 1 to 32, got ${process.env.PROMPT_MODEL_SIDECAR_CONCURRENCY}`,
    );
  }
  const interleavingSeed = "alice-qwen-production-routing-sidecar-v1";
  const orderedTasks = shuffle(tasks, interleavingSeed);
  const retainedCanary = {
    caseId: orderedTasks[0].caseRow.caseId,
    repetition: orderedTasks[0].repetition,
  };

  if (dryRun) {
    const smokeSeen = new Set();
    const smokeResults = await runPool(
      orderedTasks.map((_, index) => index),
      6,
      async (index) => {
        if (smokeSeen.has(index)) {
          throw new Error(`Dry-run pool invoked task ${index} more than once`);
        }
        smokeSeen.add(index);
        return index;
      },
    );
    if (
      smokeSeen.size !== 285 ||
      smokeResults.length !== 285 ||
      smokeResults.some((value, index) => value !== index)
    ) {
      throw new Error(
        `Dry-run pool smoke test did not invoke exactly 285 tasks: seen=${smokeSeen.size}, results=${smokeResults.length}`,
      );
    }
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          paidRequestsMade: 0,
          caseCount: cases.length,
          repetitions: 3,
          maximumCasesInAnyRepetition: cases.length,
          plannedAuthenticRequests: tasks.length,
          poolSmokeInvocations: smokeSeen.size,
          liveConcurrency: concurrency,
          promptHash: baselinePromptHash,
          qwenRoute: {
            preference: searchManifest.productionModelPreference,
            modelId: searchManifest.productionModelId,
            endpointHost: searchManifest.endpointHost,
          },
          qwenMetrics: qwenArm.metrics,
          aliceRoute: {
            preference: alicePreference,
            modelId: aliceModelId,
            endpoint,
            endpointHost,
          },
          retainedCanary,
          authenticQueryExamples: cases.slice(0, 3).map((caseRow) => caseRow.query),
        },
        null,
        2,
      ),
    );
    return;
  }

  const route = {
    endpointUrl,
    modelUri: aliceModelUri,
  };
  console.log(`starting ${orderedTasks.length} authentic Alice requests`);
  console.log(
    `running retained paid parser canary for ${retainedCanary.caseId}/repetition-${retainedCanary.repetition}`,
  );
  const outcomeByIndex = new Map();
  const providerCircuit = createProviderFailureCircuit(12);
  const canaryOutcome = await callAlice(orderedTasks[0], route);
  if (canaryOutcome.status !== "ok") {
    console.warn(
      `Retained Alice canary produced an error at ${canaryOutcome.errorStage ?? "unknown"}; preserving it and continuing under the 12-result circuit`,
    );
  }
  outcomeByIndex.set(0, canaryOutcome);
  providerCircuit.record(canaryOutcome);

  const remaining = orderedTasks.slice(1).map((task, offset) => ({
    task,
    index: offset + 1,
  }));
  const remainingOutcomes = await runPool(
    remaining,
    concurrency,
    async ({ task, index }) => {
      providerCircuit.assertClosed();
      const outcome = await callAlice(task, route);
      providerCircuit.record(outcome);
      return { index, outcome };
    },
  );
  if (
    remainingOutcomes.length !== 284 ||
    remainingOutcomes.some(
      (entry) =>
        !entry ||
        !Number.isInteger(entry.index) ||
        entry.index < 1 ||
        entry.index > 284 ||
        !entry.outcome,
    )
  ) {
    throw new Error(
      `Fan-out outcome accounting mismatch: received=${remainingOutcomes.filter(Boolean).length}, expected=284`,
    );
  }
  for (const { index, outcome } of remainingOutcomes) {
    outcomeByIndex.set(index, outcome);
  }
  if (
    remainingOutcomes.length !== 284 ||
    outcomeByIndex.size !== 285 ||
    orderedTasks.some((_, index) => !outcomeByIndex.has(index))
  ) {
    throw new Error(
      `Outcome accounting mismatch: remaining=${remainingOutcomes.length}, indexed=${outcomeByIndex.size}, expected=285`,
    );
  }

  const aliceTrials = orderedTasks.map((task, index) => ({
    dataset: "fdc-primary",
    modelArm: "alice",
    variant: "baseline",
    repetition: task.repetition,
    caseId: task.caseRow.caseId,
    sourceId: task.caseRow.sourceId,
    query: task.caseRow.query,
    expected: task.caseRow.expected,
    systemPromptHash: task.systemPromptHash,
    ...outcomeByIndex.get(index),
  }));

  const aliceArm = summarizeArm(aliceTrials, cases);

  const summary = {
    generatedAtIso: new Date().toISOString(),
    status: aliceArm.metrics.completeCoverage
      ? "accepted-complete-matched-comparison"
      : "accepted-with-alice-reliability-errors",
    dataset: {
      title: "USDA FoodData Central Foundation Foods",
      release: "April 2026",
      caseCount: cases.length,
      repetitions: 3,
      exactRequestsPerArm: 285,
      maximumCasesInAnyRepetition: 95,
    },
    arms: {
      qwen: {
        source: "frozen-search-baseline",
        route: {
          preference: searchManifest.productionModelPreference,
          modelId: searchManifest.productionModelId,
          endpointHost: searchManifest.endpointHost,
        },
        metrics: qwenArm.metrics,
      },
      alice: {
        source: "live-production-selector",
        route: {
          preference: alicePreference,
          modelId: aliceModelId,
          endpoint,
          endpointHost,
        },
        observedProviderModels: [
          ...new Set(
            aliceTrials
              .map((trial) => trial.providerModel)
              .filter((model) => typeof model === "string" && model),
          ),
        ].sort(),
        metrics: aliceArm.metrics,
      },
    },
    pairedComparison: pairedComparison(qwenArm, aliceArm),
    inference:
      "Paired case-level bootstrap of Alice/Qwen MAE ratios after averaging each case across three repetitions; 10,000 seeded resamples; two-sided percentile 95% interval. Computed only when both arms have complete contract-valid coverage.",
    latencyInterpretation:
      "Latency is descriptive across runs, not a controlled intrinsic-speed comparison: Alice is measured in this sidecar and Qwen is reused from the earlier interleaved multi-arm search.",
  };
  const datasetSnapshot = {
    source: {
      title: "USDA FoodData Central Foundation Foods",
      release: "April 2026",
      url: "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip",
    },
    rule:
      "Exact reuse of all 95 frozen Foundation search cases, user messages, expected calories/protein, and order; no post-output exclusions.",
    cases,
  };
  const manifest = {
    experimentId: "2026-08-17-alice-qwen-production-routing-sidecar-v1",
    createdAtIso: new Date().toISOString(),
    gitCommit: resolveGitCommit(),
    searchExperimentId: searchManifest.experimentId,
    searchGitCommit: searchManifest.gitCommit,
    searchManifestSha256: sha256(searchManifestText),
    searchSummarySha256: sha256(searchSummaryText),
    searchDatasetSha256: sha256(searchDatasetText),
    searchTrialsSha256: sha256(searchTrialsText),
    endpoint,
    endpointHost,
    qwenModelPreference: searchManifest.productionModelPreference,
    qwenModelId: searchManifest.productionModelId,
    aliceModelPreference: alicePreference,
    aliceModelId,
    productionModelSelector: "configuredAiModelId/configuredAiModelUri",
    temperature: 0.1,
    repetitions: 3,
    interleavingSeed,
    concurrency,
    retryPolicy:
      "Up to three attempts only for network failures, HTTP 408/429, and HTTP 5xx. Non-retryable HTTP, provider-envelope, and local contract failures cause no additional paid request. One measured authentic Alice request is retained as a parser canary before fan-out; its outcome remains data and fan-out continues. A 12-result failure streak opens the circuit.",
    parserImplementation: "self-contained-production-contract-mirror-v1",
    bootstrapIterations: 10_000,
    latencyInterpretation:
      "Alice latency is measured in this sidecar; Qwen latency is reused from the earlier interleaved multi-arm search. Ratios are descriptive cross-run context, not controlled estimates of intrinsic model speed.",
    maximumCasesInAnyRepetition: 95,
    aliceAuthenticRequests: tasks.length,
    aliceProviderAttempts: aliceTrials.reduce(
      (sum, trial) => sum + (trial.attemptCount ?? 0),
      0,
    ),
    qwenRequestsReused: frozenQwen.baselineTrials.length,
    retainedPaidCanary: retainedCanary,
    promptHash: baselinePromptHash,
    promptTemplate: baselinePrompt,
    userMessagePolicy:
      "Exact reuse of the frozen natural exact-100g food-log messages; no evaluation instructions, expected values, or prompt policy embedded in user messages.",
    datasetSha256: sha256(JSON.stringify(datasetSnapshot)),
  };

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(
      resolve(outputDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    ),
    writeFile(
      resolve(outputDir, "dataset.json"),
      `${JSON.stringify(datasetSnapshot, null, 2)}\n`,
    ),
    writeFile(
      resolve(outputDir, "trials.ndjson"),
      `${aliceTrials.map((trial) => JSON.stringify(trial)).join("\n")}\n`,
    ),
    writeFile(
      resolve(outputDir, "summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
    ),
    writeFile(resolve(outputDir, "summary.md"), markdownSummary(summary)),
  ]);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
