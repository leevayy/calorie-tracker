import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = resolve(import.meta.dirname, "../..");
const fdcPath = resolve(
  repoRoot,
  "tmp/prompt-investigation/usda/foundation/FoodData_Central_foundation_food_json_2026-04-30.json",
);
const legacyPath = resolve(repoRoot, "analytics/trainingData.json");
const outputDir = resolve(
  repoRoot,
  "analytics/runs/2026-08-16-prompt-investigation",
);

const timing = {
  localDate: "2026-08-16",
  localTimeHm: "12:00",
  clientTimeZone: "Europe/Moscow",
  defaultLogDay: "2026-08-16",
  defaultMealType: "lunch",
};

const required = [
  "YANDEX_AI_STUDIO_API_KEY",
  "YANDEX_FOLDER_ID",
  "PRODUCTION_MODEL_ID",
  "PRODUCTION_MODEL_PREFERENCE",
];

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
if (!dryRun) {
  for (const name of required) {
    if (!process.env[name]?.trim())
      throw new Error(`Missing required environment variable: ${name}`);
  }
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const round = (value, digits = 3) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

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

/**
 * Self-contained mirror of the deployed parse-food response contract.
 * The experiment intentionally imports the production prompt builder, but not the
 * parser export: the running image may predate that export even while its response
 * contract is unchanged.
 */
function parseNutritionProviderResponse(raw, parseTiming) {
  if (typeof raw !== "string") throw new Error("AI response must be text");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI did not return JSON");

  const payload = requireObject(
    JSON.parse(raw.slice(start, end + 1)),
    "AI payload",
  );
  if (!Array.isArray(payload.foods))
    throw new Error("AI payload.foods must be an array");
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

    const trimmedDescription = food.description?.trim();
    const slug =
      typeof food.meal_slug === "string"
        ? sanitizeMealSlug(food.meal_slug)
        : null;
    return {
      name: food.name.trim(),
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      ...(food.confidence !== undefined ? { confidence: food.confidence } : {}),
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
  const fixture = `model preamble\n{\"foods\":[{\"name\":\"Fixture\",\"estimated_portion\":\"100 g\",\"nutrients\":[{\"name\":\"calories\",\"amount\":123,\"unit\":\"kcal\"},{\"name\":\"protein\",\"amount\":4.5,\"unit\":\"g\"},{\"name\":\"fat\",\"amount\":2,\"unit\":\"g\"},{\"name\":\"carbohydrates\",\"amount\":20,\"unit\":\"g\"},{\"name\":\"fiber\",\"amount\":3,\"unit\":\"g\"}],\"meal_slug\":\"fixture\",\"log_day\":\"2026-08-16\",\"meal_type\":\"lunch\"}]}\nmodel suffix`;
  const [parsed] = parseNutritionProviderResponse(fixture, timing);
  if (
    parsed?.calories !== 123 ||
    parsed?.protein !== 4.5 ||
    parsed?.portion !== "100 g"
  ) {
    throw new Error(
      "Self-contained provider parser failed its startup fixture",
    );
  }

  let rejectedMissingFiber = false;
  try {
    parseNutritionProviderResponse(
      fixture.replace(',{\"name\":\"fiber\",\"amount\":3,\"unit\":\"g\"}', ""),
      timing,
    );
  } catch {
    rejectedMissingFiber = true;
  }
  if (!rejectedMissingFiber) {
    throw new Error(
      "Self-contained provider parser accepted an invalid fixture",
    );
  }
}

function resolveGitCommit() {
  if (process.env.EXPERIMENT_GIT_COMMIT?.trim())
    return process.env.EXPERIMENT_GIT_COMMIT.trim();
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unavailable";
  }
}

function nutrient(food, id) {
  return food.foodNutrients?.find((item) => item?.nutrient?.id === id)?.amount;
}

function makeFdcCases(raw) {
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
    .sort((a, b) => a.fdcId - b.fdcId);

  if (foods.length > 100)
    throw new Error(`FDC run has ${foods.length} cases; maximum is 100`);

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

const legacyEligibleOneBased = [
  3, 6, 9, 11, 12, 13, 14, 16, 17, 20, 22, 23, 24, 25, 27, 28, 31, 32, 33, 39,
  40, 41, 42,
];

function makeLegacyCases(rows) {
  return legacyEligibleOneBased.map((oneBased) => {
    const row = rows[oneBased - 1];
    if (!row) throw new Error(`Missing legacy row ${oneBased}`);
    return {
      dataset: "legacy-sensitivity",
      caseId: `legacy-${oneBased}`,
      sourceId: String(oneBased),
      query: row.query,
      description: row.query,
      expected: row.expectedResult,
    };
  });
}

function neutralPrompt(baseline) {
  return baseline
    .replace(
      /3\. NUTRITION CONSISTENCY \(CRITICAL FOR INFERRED VALUES\)[\s\S]*?4\. ESTIMATION LOGIC/,
      `3. NUTRITION CONSISTENCY (INFERRED VALUES ONLY)\n- Estimate calories from the food's typical energy density and protein from its typical composition.\n- The 4/4/9 macro formula is only a broad sanity check because food-table energy can differ due to fiber, organic acids, alcohol, rounding, and nutrient measurement conventions.\n- Do not alter an otherwise credible food-table calorie estimate merely to force equality with 4/4/9.\n\n4. ESTIMATION LOGIC`,
    )
    .replace(
      "- Large portions (>500g) should rarely be <600 kcal unless very low-fat\n",
      "- Do not impose a calorie floor based only on total food weight.\n",
    )
    .replace(
      /12\. USER NUTRITION GOAL \(ESTIMATION BIAS\)\n- .*?\n\n13\. OUTPUT LANGUAGE/,
      "12. FACTUAL NEUTRALITY\n- Nutrition estimates describe the food consumed and MUST NOT change with a user's dietary goal.\n- For ambiguity, choose the median plausible real-world estimate rather than a diet-favorable estimate.\n\n13. OUTPUT LANGUAGE",
    );
}

function densityFirstPrompt(neutral) {
  return neutral.replace(
    "Your task:\nConvert the user input into structured nutrition data.",
    `Your task:\nConvert the user input into structured nutrition data.\n\nDENSITY-FIRST METHOD FOR INFERRED VALUES:\n- Internally identify the exact food and preparation state.\n- Preserve the consumed amount; do not substitute a generic serving when grams, milliliters, or count are explicit.\n- Choose median typical calories per 100 g and protein per 100 g from standard food-composition knowledge, then scale both to the consumed amount.\n- For a mixed dish, estimate a weighted whole-dish density.\n- Round only final values. Do not reveal intermediate reasoning.`,
  );
}

function compactPrompt() {
  return `You parse a natural food-log message into nutrition JSON.

Priority order:
1. Copy every explicit food quantity and nutrition value exactly and associate it with the correct food. Never correct an explicit value.
2. Return separate items for distinct foods eaten; return one item for a recipe or mixed dish.
3. For omitted values, identify the exact food and preparation, preserve the consumed amount, choose median typical kcal/100g and protein/100g from food-composition knowledge, then scale. Estimate fat, carbohydrate, and fiber consistently. Use 4/4/9 only as a broad sanity check, not as a reason to override credible food-table energy.
4. Nutrition is factual and must not change with dietary goals. Do not impose calorie floors based only on food weight.

User-facing name, description, and portion must be English. Slugs must be short English lowercase ASCII identifiers with 1-4 hyphen-separated tokens, excluding quantity, brand, packaging, date, and filler words. Use "unknown" only when the food truly cannot be identified.

Timing context: local date ${timing.localDate}, local time ${timing.localTimeHm}, zone ${timing.clientTimeZone}. Default log day ${timing.defaultLogDay}; default meal ${timing.defaultMealType}. Resolve explicit dates and meals from the message. Meal values are breakfast, lunch, dinner, or snack. If no timing is expressed, use the defaults.

Return one JSON object only, without markdown or prose:
{
  "foods": [{
    "name": string,
    "description": string,
    "estimated_portion": string,
    "nutrients": [
      {"name":"calories","amount":number,"unit":"kcal"},
      {"name":"protein","amount":number,"unit":"g"},
      {"name":"fat","amount":number,"unit":"g"},
      {"name":"carbohydrates","amount":number,"unit":"g"},
      {"name":"fiber","amount":number,"unit":"g"}
    ],
    "confidence": number,
    "meal_slug": string,
    "log_day": "YYYY-MM-DD",
    "meal_type": "breakfast" | "lunch" | "dinner" | "snack"
  }]
}`;
}

function trustedReference(caseRow) {
  const fields = [
    `calories_kcal_per_100g=${caseRow.reference.calories}`,
    `protein_g_per_100g=${caseRow.reference.protein}`,
  ];
  if (Number.isFinite(caseRow.reference.fats))
    fields.push(`fat_g_per_100g=${caseRow.reference.fats}`);
  if (Number.isFinite(caseRow.reference.carbs))
    fields.push(`carbohydrate_g_per_100g=${caseRow.reference.carbs}`);
  if (Number.isFinite(caseRow.reference.fiber))
    fields.push(`fiber_g_per_100g=${caseRow.reference.fiber}`);
  return `TRUSTED SERVER-SIDE FOOD REFERENCE (not user-authored):\nsource=USDA FoodData Central Foundation Foods, April 2026\nfdc_id=${caseRow.sourceId}\nfood=${caseRow.description}\n${fields.join("\n")}\nUse this reference as ground truth only when it matches the user's food and preparation. Scale it to the explicit consumed amount. Preserve the referenced calories and protein; infer only reference fields that are absent.`;
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

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bootstrapRatio(
  baseByCase,
  candidateByCase,
  metric,
  seed,
  iterations = 10_000,
) {
  const ids = [...baseByCase.keys()].filter((id) => candidateByCase.has(id));
  if (!ids.length) return null;
  const random = seededRandom(seed);
  const ratios = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let base = 0;
    let candidate = 0;
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[Math.floor(random() * ids.length)];
      base += baseByCase.get(id)[metric];
      candidate += candidateByCase.get(id)[metric];
    }
    ratios.push(
      base === 0
        ? candidate === 0
          ? 0
          : Number.POSITIVE_INFINITY
        : candidate / base,
    );
  }
  return {
    lower95: round(percentile(ratios, 0.025)),
    upper95: round(percentile(ratios, 0.975)),
  };
}

async function callModel(task) {
  const apiKey = process.env.YANDEX_AI_STUDIO_API_KEY;
  const modelId = process.env.PRODUCTION_MODEL_ID;
  const model = modelId.startsWith("gpt://")
    ? modelId
    : `gpt://${process.env.YANDEX_FOLDER_ID}/${modelId}`;
  const authorization = apiKey.startsWith("AQVN")
    ? `Api-Key ${apiKey}`
    : `Bearer ${apiKey}`;
  let lastError;
  const overallStarted = performance.now();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let completion;
    let content;
    try {
      const response = await fetch(
        process.env.YANDEX_AI_STUDIO_URL ||
          "https://ai.api.cloud.yandex.net/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
            "x-folder-id": process.env.YANDEX_FOLDER_ID,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: task.systemPrompt },
              { role: "user", content: task.caseRow.query },
            ],
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(180_000),
        },
      );
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

      // A local contract failure is deterministic for this response. Preserve the
      // authentic model output, classify it separately, and never pay for retries.
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
            suggestions.reduce((sum, item) => sum + item.calories, 0),
          ),
          protein: round(
            suggestions.reduce((sum, item) => sum + item.protein, 0),
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

function summarize(trials, datasets, variants) {
  const summary = { generatedAtIso: new Date().toISOString(), datasets: {} };
  for (const [datasetName, cases] of Object.entries(datasets)) {
    const datasetTrials = trials.filter(
      (trial) => trial.dataset === datasetName,
    );
    const datasetSummary = {
      caseCount: cases.length,
      repetitions: 3,
      variants: {},
      comparisonsToBaseline: {},
    };
    const byVariantAndCase = new Map();

    for (const variant of variants.filter((item) =>
      item.datasets.includes(datasetName),
    )) {
      const rows = datasetTrials.filter(
        (trial) => trial.variant === variant.id,
      );
      const ok = rows.filter((trial) => trial.status === "ok");
      const calorieErrors = ok.map((trial) =>
        Math.abs(trial.totals.calories - trial.expected.calories),
      );
      const proteinErrors = ok.map((trial) =>
        Math.abs(trial.totals.protein - trial.expected.protein),
      );
      const latencies = ok.map((trial) => trial.latencyMs);
      const caseMap = new Map();
      for (const caseRow of cases) {
        const repeated = ok.filter((trial) => trial.caseId === caseRow.caseId);
        if (repeated.length !== 3) continue;
        caseMap.set(caseRow.caseId, {
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
      byVariantAndCase.set(variant.id, caseMap);
      datasetSummary.variants[variant.id] = {
        kind: variant.kind,
        trialCount: rows.length,
        successfulTrials: ok.length,
        coveragePct: round((100 * ok.length) / rows.length),
        firstAttemptSuccessPct: round(
          (100 * rows.filter((trial) => trial.firstAttemptOk).length) /
            rows.length,
        ),
        completeCasesAcrossRepetitions: caseMap.size,
        eligible: ok.length === rows.length && caseMap.size === cases.length,
        calorieMae: round(mean(calorieErrors)),
        proteinMae: round(mean(proteinErrors)),
        calorieMedianAbsoluteError: round(percentile(calorieErrors, 0.5)),
        calorieP90AbsoluteError: round(percentile(calorieErrors, 0.9)),
        proteinMedianAbsoluteError: round(percentile(proteinErrors, 0.5)),
        proteinP90AbsoluteError: round(percentile(proteinErrors, 0.9)),
        latencyP50Ms: round(percentile(latencies, 0.5), 1),
        latencyP95Ms: round(percentile(latencies, 0.95), 1),
      };
    }

    const baseline = datasetSummary.variants.baseline;
    const baselineByCase = byVariantAndCase.get("baseline");
    for (const variant of variants.filter(
      (item) => item.id !== "baseline" && item.datasets.includes(datasetName),
    )) {
      const candidate = datasetSummary.variants[variant.id];
      const calorieRatio = candidate.calorieMae / baseline.calorieMae;
      const proteinRatio = candidate.proteinMae / baseline.proteinMae;
      const calorieCi = bootstrapRatio(
        baselineByCase,
        byVariantAndCase.get(variant.id),
        "calories",
        `${datasetName}:${variant.id}:calories`,
      );
      const proteinCi = bootstrapRatio(
        baselineByCase,
        byVariantAndCase.get(variant.id),
        "protein",
        `${datasetName}:${variant.id}:protein`,
      );
      const comparisonEligible = baseline.eligible && candidate.eligible;
      const strongCalories =
        Number.isFinite(calorieCi?.upper95) && calorieCi.upper95 <= 0.5;
      const strongProtein =
        Number.isFinite(proteinCi?.upper95) && proteinCi.upper95 <= 0.5;
      datasetSummary.comparisonsToBaseline[variant.id] = {
        calorieMaeRatio: round(calorieRatio),
        calorieMaeReductionPct: round(100 * (1 - calorieRatio)),
        calorieRatioBootstrap95: calorieCi,
        proteinMaeRatio: round(proteinRatio),
        proteinMaeReductionPct: round(100 * (1 - proteinRatio)),
        proteinRatioBootstrap95: proteinCi,
        pointGoal50Calories: comparisonEligible && calorieRatio <= 0.5,
        strongGoal50Calories: comparisonEligible && strongCalories,
        pointGoal50Both:
          comparisonEligible && calorieRatio <= 0.5 && proteinRatio <= 0.5,
        strongGoal50Both: comparisonEligible && strongCalories && strongProtein,
        eligible: comparisonEligible,
      };
    }
    summary.datasets[datasetName] = datasetSummary;
  }
  return summary;
}

async function main() {
  parserSelfTest();
  const fdcRaw = JSON.parse(await readFile(fdcPath, "utf8"));
  const legacyRaw = JSON.parse(await readFile(legacyPath, "utf8"));
  const datasets = {
    "fdc-primary": makeFdcCases(fdcRaw),
    "legacy-sensitivity": makeLegacyCases(legacyRaw),
  };
  if (datasets["fdc-primary"].length !== 95) {
    throw new Error(
      `Expected 95 primary cases, found ${datasets["fdc-primary"].length}`,
    );
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          primaryCases: datasets["fdc-primary"].length,
          legacyCases: datasets["legacy-sensitivity"].length,
          maxCasesPerRun: Math.max(
            ...Object.values(datasets).map((rows) => rows.length),
          ),
          authenticQueryExamples: datasets["fdc-primary"]
            .slice(0, 3)
            .map((row) => row.query),
        },
        null,
        2,
      ),
    );
    return;
  }

  const productionAiModule = await import("../../backend/src/services/ai.ts");
  if (typeof productionAiModule.buildNutritionParserSystem !== "function") {
    throw new Error(
      "Production buildNutritionParserSystem export is unavailable",
    );
  }
  const { buildNutritionParserSystem } = productionAiModule;
  const baseline = buildNutritionParserSystem("en", "maintain", timing);
  const neutral = neutralPrompt(baseline);
  const density = densityFirstPrompt(neutral);
  const compact = compactPrompt();
  if (
    neutral === baseline ||
    !neutral.includes("12. FACTUAL NEUTRALITY") ||
    !neutral.includes(
      "Do not impose a calorie floor based only on total food weight",
    ) ||
    neutral.includes("If mismatch >10%, FIX the numbers") ||
    neutral.includes("Large portions (>500g) should rarely be <600 kcal")
  ) {
    throw new Error(
      "Neutral prompt transformation did not fully match the deployed production prompt",
    );
  }
  if (
    density === neutral ||
    !density.includes("DENSITY-FIRST METHOD FOR INFERRED VALUES")
  ) {
    throw new Error("Density-first prompt transformation was not applied");
  }
  if (!compact.includes("Return one JSON object only") || compact === density) {
    throw new Error(
      "Compact prompt construction failed its structural assertion",
    );
  }
  const variants = [
    {
      id: "baseline",
      kind: "production-prompt",
      datasets: ["fdc-primary", "legacy-sensitivity"],
      template: baseline,
      build: () => baseline,
    },
    {
      id: "neutral",
      kind: "prompt-only",
      datasets: ["fdc-primary", "legacy-sensitivity"],
      template: neutral,
      build: () => neutral,
    },
    {
      id: "density-first",
      kind: "prompt-only",
      datasets: ["fdc-primary", "legacy-sensitivity"],
      template: density,
      build: () => density,
    },
    {
      id: "compact",
      kind: "prompt-only",
      datasets: ["fdc-primary", "legacy-sensitivity"],
      template: compact,
      build: () => compact,
    },
    {
      id: "grounded-reference",
      kind: "retrieval-assisted",
      datasets: ["fdc-primary"],
      template: `${density}\n\n{{TRUSTED_SERVER_REFERENCE}}`,
      build: (caseRow) => `${density}\n\n${trustedReference(caseRow)}`,
    },
  ];

  const tasks = [];
  for (const [datasetName, cases] of Object.entries(datasets)) {
    for (const variant of variants.filter((item) =>
      item.datasets.includes(datasetName),
    )) {
      for (let repetition = 1; repetition <= 3; repetition += 1) {
        for (const caseRow of cases) {
          const systemPrompt = variant.build(caseRow);
          tasks.push({
            dataset: datasetName,
            variant: variant.id,
            repetition,
            caseRow,
            systemPrompt,
            systemPromptHash: sha256(systemPrompt),
          });
        }
      }
    }
  }
  const orderedTasks = shuffle(
    tasks,
    "calorie-tracker-prompt-investigation-v1",
  );
  console.log(`starting ${orderedTasks.length} authentic model requests`);

  // Gate fan-out on one retained paid canary for every dataset/variant group.
  // This tests each prompt shape and both languages without adding model calls.
  const canaryIndexes = [];
  const seenCanaryGroups = new Set();
  for (const [index, task] of orderedTasks.entries()) {
    const group = `${task.dataset}/${task.variant}`;
    if (!seenCanaryGroups.has(group)) {
      seenCanaryGroups.add(group);
      canaryIndexes.push(index);
    }
  }
  if (canaryIndexes.length !== 9) {
    throw new Error(
      `Expected 9 dataset/variant canaries, found ${canaryIndexes.length}`,
    );
  }

  const outcomeByIndex = new Map();
  for (const index of canaryIndexes) {
    const canaryTask = orderedTasks[index];
    console.log(
      `running paid parser canary for ${canaryTask.dataset}/${canaryTask.variant}`,
    );
    const canaryOutcome = await callModel(canaryTask);
    if (canaryOutcome.status !== "ok") {
      throw new Error(
        `Paid parser canary failed for ${canaryTask.dataset}/${canaryTask.variant} at ${canaryOutcome.errorStage ?? "unknown"}: ${canaryOutcome.error}`,
      );
    }
    outcomeByIndex.set(index, canaryOutcome);
  }
  console.log("all 9 paid parser canaries passed; starting paired fan-out");

  const canaryIndexSet = new Set(canaryIndexes);
  const remainingIndexedTasks = orderedTasks
    .map((task, index) => ({ task, index }))
    .filter(({ index }) => !canaryIndexSet.has(index));
  let consecutiveFailures = 0;
  let failureCircuitOpen = false;
  const remainingOutcomes = await runPool(
    remainingIndexedTasks,
    Math.max(1, Number(process.env.PROMPT_INVESTIGATION_CONCURRENCY || 6)),
    async ({ task, index }) => {
      if (failureCircuitOpen) {
        throw new Error(
          "Provider failure circuit is open; aborting before additional paid requests",
        );
      }
      const outcome = await callModel(task);
      if (outcome.status === "error") {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 12) failureCircuitOpen = true;
      } else {
        consecutiveFailures = 0;
      }
      return { index, outcome };
    },
  );
  for (const { index, outcome } of remainingOutcomes) {
    outcomeByIndex.set(index, outcome);
  }
  const outcomes = orderedTasks.map((task, index) => ({
    dataset: task.dataset,
    variant: task.variant,
    repetition: task.repetition,
    caseId: task.caseRow.caseId,
    sourceId: task.caseRow.sourceId,
    query: task.caseRow.query,
    expected: task.caseRow.expected,
    systemPromptHash: task.systemPromptHash,
    ...outcomeByIndex.get(index),
  }));

  await mkdir(outputDir, { recursive: true });
  const datasetSnapshot = {
    source: {
      title: "USDA FoodData Central Foundation Foods",
      release: "April 2026",
      url: "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip",
    },
    primaryRule:
      "All non-null Foundation Food entries with finite USDA nutrient 1008 (kcal/100g) and 1003 (protein g/100g); exact 100 g natural-language request; no post-output exclusions.",
    primaryCases: datasets["fdc-primary"],
    legacyRule:
      "Frozen pre-output manual label-quality mask from the repository's Russian benchmark; sensitivity analysis only.",
    legacyEligibleOneBased,
    legacyCases: datasets["legacy-sensitivity"],
  };
  const manifest = {
    experimentId: "2026-08-16-prompt-investigation-v1",
    createdAtIso: new Date().toISOString(),
    gitCommit: resolveGitCommit(),
    endpointHost: new URL(
      process.env.YANDEX_AI_STUDIO_URL ||
        "https://ai.api.cloud.yandex.net/v1/chat/completions",
    ).host,
    productionModelPreference: process.env.PRODUCTION_MODEL_PREFERENCE,
    productionModelId: process.env.PRODUCTION_MODEL_ID,
    temperature: 0.1,
    repetitions: 3,
    interleavingSeed: "calorie-tracker-prompt-investigation-v1",
    concurrency: Number(process.env.PROMPT_INVESTIGATION_CONCURRENCY || 6),
    retryPolicy:
      "Up to three attempts only for network failures, HTTP 408/429, and HTTP 5xx. Non-retryable HTTP, provider-envelope, and local contract failures cause no additional paid request. Nine measured authentic requests (one per dataset/variant group) must parse successfully before fan-out; a 12-result failure streak opens the circuit.",
    maximumCasesInAnyVariantRepetition: 95,
    totalAuthenticRequests: tasks.length,
    totalProviderAttempts: outcomes.reduce(
      (sum, outcome) => sum + (outcome.attemptCount ?? 0),
      0,
    ),
    userMessagePolicy:
      "Identical natural food-log text across variants; no evaluation instructions, expected values, or prompt policy embedded in user messages.",
    variants: variants.map((variant) => ({
      id: variant.id,
      kind: variant.kind,
      datasets: variant.datasets,
      promptHash: sha256(variant.template),
      promptTemplate: variant.template,
    })),
    datasetSha256: sha256(JSON.stringify(datasetSnapshot)),
  };
  const summary = summarize(outcomes, datasets, variants);

  await writeFile(
    resolve(outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(
    resolve(outputDir, "dataset.json"),
    `${JSON.stringify(datasetSnapshot, null, 2)}\n`,
  );
  await writeFile(
    resolve(outputDir, "trials.ndjson"),
    `${outcomes.map((outcome) => JSON.stringify(outcome)).join("\n")}\n`,
  );
  await writeFile(
    resolve(outputDir, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
