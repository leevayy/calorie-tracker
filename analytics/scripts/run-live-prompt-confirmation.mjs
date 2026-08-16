import { createHash } from "node:crypto";
import { createReadStream, realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const repoRoot = resolve(import.meta.dirname, "../..");
const foundationPath = resolve(
  process.env.FOUNDATION_JSON_PATH ||
    resolve(
      repoRoot,
      "tmp/prompt-investigation/usda/foundation/FoodData_Central_foundation_food_json_2026-04-30.json",
    ),
);
const srLegacyPath = resolve(
  process.env.SR_LEGACY_JSON_PATH ||
    resolve(
      repoRoot,
      "tmp/prompt-investigation/usda/sr-legacy/FoodData_Central_sr_legacy_food_json_2018-04.json",
    ),
);
const searchResultsDir = resolve(
  process.env.PROMPT_SEARCH_RESULTS_DIR ||
    resolve(repoRoot, "analytics/runs/2026-08-16-prompt-investigation"),
);
const outputDir = resolve(
  process.env.PROMPT_CONFIRMATION_OUTPUT_DIR ||
    resolve(repoRoot, "analytics/runs/2026-08-16-prompt-confirmation"),
);

const timing = {
  localDate: "2026-08-16",
  localTimeHm: "12:00",
  clientTimeZone: "Europe/Moscow",
  defaultLogDay: "2026-08-16",
  defaultMealType: "lunch",
};

const selectionSeed = "calorie-tracker-confirmation-sr-legacy-v1";
const interleavingSeed = "calorie-tracker-prompt-confirmation-v1";
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const required = [
  "YANDEX_AI_STUDIO_API_KEY",
  "YANDEX_FOLDER_ID",
  "PRODUCTION_MODEL_ID",
  "PRODUCTION_MODEL_PREFERENCE",
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const round = (value, digits = 3) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const mean = (values) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

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

function normalizedDescription(description) {
  return description.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function makeFoundationCases(raw) {
  return raw.FoundationFoods.filter(Boolean)
    .map((food) => ({
      fdcId: food.fdcId,
      description: food.description,
      calories: nutrient(food, 1008),
      protein: nutrient(food, 1003),
    }))
    .filter(
      (food) => Number.isFinite(food.calories) && Number.isFinite(food.protein),
    )
    .sort((a, b) => a.fdcId - b.fdcId);
}

function firstBalancedObject(line) {
  const start = line.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < line.length; index += 1) {
    const character = line[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return line.slice(start, index + 1);
    }
  }
  return null;
}

async function readSrLegacyEligible(excludedDescriptions) {
  const eligible = [];
  let sourceFoodCount = 0;
  const lines = createInterface({
    input: createReadStream(srLegacyPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith("{") || trimmed.startsWith('{"SRLegacyFoods"'))
      continue;
    const objectText = firstBalancedObject(trimmed);
    if (!objectText)
      throw new Error("Could not isolate an SR Legacy food object");
    const food = JSON.parse(objectText);
    sourceFoodCount += 1;
    const calories = nutrient(food, 1008);
    const protein = nutrient(food, 1003);
    const description =
      typeof food.description === "string" ? food.description.trim() : "";
    if (
      !description ||
      !Number.isFinite(food.fdcId) ||
      !Number.isFinite(calories) ||
      !Number.isFinite(protein) ||
      calories < 0 ||
      protein < 0 ||
      excludedDescriptions.has(normalizedDescription(description))
    ) {
      continue;
    }
    eligible.push({
      fdcId: food.fdcId,
      description,
      calories,
      protein,
      fats: nutrient(food, 1004),
      carbs: nutrient(food, 1005),
      fiber: nutrient(food, 1079),
    });
  }
  return { eligible, sourceFoodCount };
}

async function makeConfirmationCases(foundationCases) {
  const excludedDescriptions = new Set(
    foundationCases.map((food) => normalizedDescription(food.description)),
  );
  const { eligible, sourceFoodCount } =
    await readSrLegacyEligible(excludedDescriptions);
  const ranked = eligible
    .map((food) => ({
      ...food,
      selectionHash: sha256(
        `${selectionSeed}\n${food.fdcId}\n${normalizedDescription(food.description)}`,
      ),
    }))
    .sort(
      (left, right) =>
        (left.selectionHash < right.selectionHash
          ? -1
          : left.selectionHash > right.selectionHash
            ? 1
            : 0) ||
        left.fdcId - right.fdcId ||
        (left.description < right.description
          ? -1
          : left.description > right.description
            ? 1
            : 0),
    );
  if (ranked.length < 100) {
    throw new Error(
      `Only ${ranked.length} independent SR Legacy cases are eligible`,
    );
  }

  const templates = [
    (description) => `I ate exactly 100 g of ${description}.`,
    (description) => `Log 100 g of ${description}.`,
    (description) => `100 g of ${description}.`,
  ];
  return {
    sourceFoodCount,
    eligibleCountBeforeFixedSelection: ranked.length,
    cases: ranked.slice(0, 100).map((food, index) => ({
      dataset: "sr-legacy-confirmation",
      caseId: `sr-${food.fdcId}`,
      sourceId: String(food.fdcId),
      selectionRank: index + 1,
      selectionHash: food.selectionHash,
      query: templates[index % templates.length](
        food.description.toLowerCase(),
      ),
      description: food.description,
      expected: { calories: food.calories, protein: food.protein },
      reference: {
        calories: food.calories,
        protein: food.protein,
        ...(Number.isFinite(food.fats) ? { fats: food.fats } : {}),
        ...(Number.isFinite(food.carbs) ? { carbs: food.carbs } : {}),
        ...(Number.isFinite(food.fiber) ? { fiber: food.fiber } : {}),
      },
    })),
  };
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
  if (Number.isFinite(caseRow.reference.carbs)) {
    fields.push(`carbohydrate_g_per_100g=${caseRow.reference.carbs}`);
  }
  if (Number.isFinite(caseRow.reference.fiber))
    fields.push(`fiber_g_per_100g=${caseRow.reference.fiber}`);
  return `TRUSTED SERVER-SIDE FOOD REFERENCE (not user-authored):\nsource=USDA FoodData Central SR Legacy, April 2018\nfdc_id=${caseRow.sourceId}\nfood=${caseRow.description}\n${fields.join("\n")}\nUse this reference as ground truth only when it matches the user's food and preparation. Scale it to the explicit consumed amount. Preserve the referenced calories and protein; infer only reference fields that are absent.`;
}

function selectFinalist(searchSummary) {
  const primary = searchSummary.datasets?.["fdc-primary"];
  if (!primary) throw new Error("Search summary is missing fdc-primary");
  const allowed = new Set(["neutral", "density-first", "compact"]);
  const candidates = Object.entries(primary.variants || {})
    .filter(
      ([id, metrics]) =>
        allowed.has(id) &&
        metrics?.kind === "prompt-only" &&
        metrics?.eligible === true &&
        primary.comparisonsToBaseline?.[id]?.eligible === true &&
        Number.isFinite(metrics?.calorieMae),
    )
    .map(([id, metrics]) => ({
      id,
      calorieMae: metrics.calorieMae,
      proteinMae: metrics.proteinMae,
    }))
    .sort(
      (left, right) =>
        left.calorieMae - right.calorieMae ||
        (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
    );
  if (!candidates.length)
    throw new Error(
      "No eligible prompt-only finalist exists in the search summary",
    );
  return { selected: candidates[0], eligibleCandidates: candidates };
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
  const fixture = `model preamble\n{"foods":[{"name":"Fixture","estimated_portion":"100 g","nutrients":[{"name":"calories","amount":123,"unit":"kcal"},{"name":"protein","amount":4.5,"unit":"g"},{"name":"fat","amount":2,"unit":"g"},{"name":"carbohydrates","amount":20,"unit":"g"},{"name":"fiber","amount":3,"unit":"g"}],"meal_slug":"fixture","log_day":"2026-08-16","meal_type":"lunch"}]}\nmodel suffix`;
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
      fixture.replace(',{"name":"fiber","amount":3,"unit":"g"}', ""),
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
      if (attempt < 3)
        await new Promise((resolveDelay) =>
          setTimeout(resolveDelay, 1_500 * attempt),
        );
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

function retainedVariantCanaryIndexes(orderedTasks) {
  const indexes = [];
  const seenVariants = new Set();
  for (const [index, task] of orderedTasks.entries()) {
    if (seenVariants.has(task.variant)) continue;
    seenVariants.add(task.variant);
    indexes.push(index);
  }
  return indexes;
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
      return { consecutiveFailures, open, threshold };
    },
  };
}

function summarize(trials, cases, variants, finalistSelection) {
  const datasetName = "sr-legacy-confirmation";
  const datasetSummary = {
    caseCount: cases.length,
    repetitions: 3,
    selectedPromptOnlyFinalist: finalistSelection.selected,
    eligibleSearchCandidates: finalistSelection.eligibleCandidates,
    variants: {},
    comparisonsToBaseline: {},
  };
  const byVariantAndCase = new Map();

  for (const variant of variants) {
    const rows = trials.filter((trial) => trial.variant === variant.id);
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
  for (const variant of variants.filter((item) => item.id !== "baseline")) {
    const candidate = datasetSummary.variants[variant.id];
    const calorieRatio =
      Number.isFinite(candidate.calorieMae) &&
      Number.isFinite(baseline.calorieMae) &&
      baseline.calorieMae > 0
        ? candidate.calorieMae / baseline.calorieMae
        : null;
    const proteinRatio =
      Number.isFinite(candidate.proteinMae) &&
      Number.isFinite(baseline.proteinMae) &&
      baseline.proteinMae > 0
        ? candidate.proteinMae / baseline.proteinMae
        : null;
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
      calorieMaeReductionPct: round(
        Number.isFinite(calorieRatio) ? 100 * (1 - calorieRatio) : null,
      ),
      calorieRatioBootstrap95: calorieCi,
      proteinMaeRatio: round(proteinRatio),
      proteinMaeReductionPct: round(
        Number.isFinite(proteinRatio) ? 100 * (1 - proteinRatio) : null,
      ),
      proteinRatioBootstrap95: proteinCi,
      pointGoal50Calories:
        comparisonEligible &&
        Number.isFinite(calorieRatio) &&
        calorieRatio <= 0.5,
      strongGoal50Calories: comparisonEligible && strongCalories,
      pointGoal50Both:
        comparisonEligible &&
        Number.isFinite(calorieRatio) &&
        Number.isFinite(proteinRatio) &&
        calorieRatio <= 0.5 &&
        proteinRatio <= 0.5,
      strongGoal50Both: comparisonEligible && strongCalories && strongProtein,
      eligible: comparisonEligible,
    };
  }
  return {
    generatedAtIso: new Date().toISOString(),
    datasets: { [datasetName]: datasetSummary },
  };
}

function variantById(variants, id) {
  const variant = variants.find((item) => item.id === id);
  if (!variant) throw new Error(`Could not reconstruct search finalist: ${id}`);
  return variant;
}

async function main() {
  parserSelfTest();
  if (!dryRun) {
    for (const name of required) {
      if (!process.env[name]?.trim()) {
        throw new Error(`Missing required environment variable: ${name}`);
      }
    }
  }
  const [
    foundationRaw,
    searchManifestText,
    searchSummaryText,
    searchDatasetText,
  ] = await Promise.all([
    readFile(foundationPath, "utf8").then(JSON.parse),
    readFile(resolve(searchResultsDir, "manifest.json"), "utf8"),
    readFile(resolve(searchResultsDir, "summary.json"), "utf8"),
    readFile(resolve(searchResultsDir, "dataset.json"), "utf8"),
  ]);
  const searchManifest = JSON.parse(searchManifestText);
  const searchSummary = JSON.parse(searchSummaryText);
  const searchDataset = JSON.parse(searchDatasetText);
  const foundationCases = makeFoundationCases(foundationRaw);
  if (foundationCases.length !== 95) {
    throw new Error(
      `Expected 95 Foundation overlap cases, found ${foundationCases.length}`,
    );
  }
  const searchFoundationById = new Map(
    (searchDataset.primaryCases || []).map((caseRow) => [
      String(caseRow.sourceId),
      normalizedDescription(caseRow.description),
    ]),
  );
  if (
    searchFoundationById.size !== 95 ||
    foundationCases.some(
      (food) =>
        searchFoundationById.get(String(food.fdcId)) !==
        normalizedDescription(food.description),
    )
  ) {
    throw new Error(
      "Downloaded Foundation dataset does not reproduce the search set",
    );
  }

  const actualPreference = process.env.PRODUCTION_MODEL_PREFERENCE?.trim();
  const actualModelId = process.env.PRODUCTION_MODEL_ID?.trim();
  if (
    (actualPreference &&
      actualPreference !== searchManifest.productionModelPreference) ||
    (actualModelId && actualModelId !== searchManifest.productionModelId)
  ) {
    throw new Error(
      `Production model changed since search: expected ${searchManifest.productionModelPreference}/${searchManifest.productionModelId}, got ${actualPreference || "unset"}/${actualModelId || "unset"}`,
    );
  }
  if (!dryRun && (!actualPreference || !actualModelId)) {
    throw new Error(
      "Production model identity is required for a paid confirmation run",
    );
  }

  const finalistSelection = selectFinalist(searchSummary);
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
  const reconstructed = [
    {
      id: "baseline",
      kind: "production-prompt",
      template: baseline,
      build: () => baseline,
    },
    {
      id: "neutral",
      kind: "prompt-only",
      template: neutral,
      build: () => neutral,
    },
    {
      id: "density-first",
      kind: "prompt-only",
      template: density,
      build: () => density,
    },
    {
      id: "compact",
      kind: "prompt-only",
      template: compact,
      build: () => compact,
    },
  ];
  const finalist = variantById(reconstructed, finalistSelection.selected.id);
  const groundedTemplate = `${density}\n\n{{TRUSTED_SERVER_REFERENCE}}`;
  const variants = [
    variantById(reconstructed, "baseline"),
    finalist,
    {
      id: "grounded-reference",
      kind: "retrieval-assisted",
      template: groundedTemplate,
      build: (caseRow) => `${density}\n\n${trustedReference(caseRow)}`,
    },
  ];

  for (const variant of variants) {
    const searchVariant = searchManifest.variants?.find(
      (item) => item.id === variant.id,
    );
    if (!searchVariant)
      throw new Error(`Search manifest is missing ${variant.id}`);
    if (searchVariant.promptHash !== sha256(variant.template)) {
      throw new Error(
        `Reconstructed prompt hash differs from search manifest for ${variant.id}`,
      );
    }
  }

  const selection = await makeConfirmationCases(foundationCases);
  const cases = selection.cases;
  if (cases.length !== 100)
    throw new Error(
      `Expected exactly 100 confirmation cases, found ${cases.length}`,
    );
  if (new Set(cases.map((caseRow) => caseRow.caseId)).size !== cases.length) {
    throw new Error("Confirmation selection contains duplicate source IDs");
  }
  const overlap = new Set(
    foundationCases.map((food) => normalizedDescription(food.description)),
  );
  if (
    cases.some((caseRow) =>
      overlap.has(normalizedDescription(caseRow.description)),
    )
  ) {
    throw new Error("Confirmation selection overlaps a Foundation description");
  }

  const tasks = [];
  for (const variant of variants) {
    for (let repetition = 1; repetition <= 3; repetition += 1) {
      for (const caseRow of cases) {
        const systemPrompt = variant.build(caseRow);
        tasks.push({
          dataset: "sr-legacy-confirmation",
          variant: variant.id,
          repetition,
          caseRow,
          systemPrompt,
          systemPromptHash: sha256(systemPrompt),
        });
      }
    }
  }
  if (tasks.length !== 900)
    throw new Error(`Expected exactly 900 requests, built ${tasks.length}`);
  const queryByCase = new Map();
  for (const task of tasks) {
    const existing = queryByCase.get(task.caseRow.caseId);
    if (existing && existing !== task.caseRow.query) {
      throw new Error(
        `User message changed across variants for ${task.caseRow.caseId}`,
      );
    }
    queryByCase.set(task.caseRow.caseId, task.caseRow.query);
  }
  const orderedTasks = shuffle(tasks, interleavingSeed);
  const canaryIndexes = retainedVariantCanaryIndexes(orderedTasks);
  if (canaryIndexes.length !== 3) {
    throw new Error(
      `Expected 3 variant canaries, found ${canaryIndexes.length}`,
    );
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          confirmationCases: cases.length,
          srLegacySourceFoodCount: selection.sourceFoodCount,
          eligibleBeforeSelection: selection.eligibleCountBeforeFixedSelection,
          foundationDescriptionsExcluded: overlap.size,
          selectedPromptOnlyFinalist: finalistSelection.selected,
          finalistPromptHash: sha256(finalist.template),
          modelExpectedFromSearch: {
            preference: searchManifest.productionModelPreference,
            id: searchManifest.productionModelId,
          },
          variants: variants.map((variant) => ({
            id: variant.id,
            kind: variant.kind,
            promptHash: sha256(variant.template),
          })),
          repetitions: 3,
          maximumCasesInAnyVariantRepetition: 100,
          totalAuthenticRequests: tasks.length,
          retainedPaidCanaries: canaryIndexes.map((index) => ({
            variant: orderedTasks[index].variant,
            caseId: orderedTasks[index].caseRow.caseId,
            repetition: orderedTasks[index].repetition,
          })),
          uniqueUserMessages: queryByCase.size,
          authenticQueryExamples: cases
            .slice(0, 3)
            .map((caseRow) => caseRow.query),
          selectionFirstThree: cases.slice(0, 3).map((caseRow) => ({
            caseId: caseRow.caseId,
            selectionHash: caseRow.selectionHash,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`starting ${orderedTasks.length} authentic model requests`);

  // Gate fan-out on one retained paid canary for each of the three variants.
  // This tests every prompt shape without adding model calls.
  const outcomeByIndex = new Map();
  for (const index of canaryIndexes) {
    const canaryTask = orderedTasks[index];
    console.log(`running paid parser canary for ${canaryTask.variant}`);
    const canaryOutcome = await callModel(canaryTask);
    if (canaryOutcome.status !== "ok") {
      throw new Error(
        `Paid parser canary failed for ${canaryTask.variant} at ${canaryOutcome.errorStage ?? "unknown"}: ${canaryOutcome.error}`,
      );
    }
    outcomeByIndex.set(index, canaryOutcome);
  }
  console.log("all 3 paid parser canaries passed; starting paired fan-out");

  const canaryIndexSet = new Set(canaryIndexes);
  const remainingIndexedTasks = orderedTasks
    .map((task, index) => ({ task, index }))
    .filter(({ index }) => !canaryIndexSet.has(index));
  const providerCircuit = createProviderFailureCircuit(12);
  const remainingOutcomes = await runPool(
    remainingIndexedTasks,
    Math.max(1, Number(process.env.PROMPT_CONFIRMATION_CONCURRENCY || 6)),
    async ({ task, index }) => {
      providerCircuit.assertClosed();
      const outcome = await callModel(task);
      providerCircuit.record(outcome);
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
      title: "USDA FoodData Central SR Legacy Foods",
      release: "April 2018",
      url: "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip",
    },
    independenceSource: {
      title: "USDA FoodData Central Foundation Foods",
      release: "April 2026",
      url: "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip",
      reproducedSearchCaseCount: foundationCases.length,
    },
    rule: "Select exactly 100 SR Legacy foods with finite nonnegative USDA nutrient 1008 (kcal/100g) and 1003 (protein g/100g), excluding normalized case-insensitive exact description matches to the 95 Foundation search cases. Rank before any model call by SHA-256 of the newline-delimited seed, fdcId, and normalized description; take the first 100. Exact 100 g natural-language request; no post-output exclusions.",
    selectionSeed,
    sourceFoodCount: selection.sourceFoodCount,
    eligibleCountBeforeFixedSelection:
      selection.eligibleCountBeforeFixedSelection,
    cases,
  };
  const manifest = {
    experimentId: "2026-08-16-prompt-confirmation-v1",
    createdAtIso: new Date().toISOString(),
    gitCommit: resolveGitCommit(),
    searchExperimentId: searchManifest.experimentId,
    searchGitCommit: searchManifest.gitCommit,
    searchManifestSha256: sha256(searchManifestText),
    searchSummarySha256: sha256(searchSummaryText),
    endpointHost: new URL(
      process.env.YANDEX_AI_STUDIO_URL ||
        "https://ai.api.cloud.yandex.net/v1/chat/completions",
    ).host,
    productionModelPreference: actualPreference,
    productionModelId: actualModelId,
    productionModelMatchesSearch: true,
    temperature: 0.1,
    repetitions: 3,
    selectionSeed,
    interleavingSeed,
    concurrency: Number(process.env.PROMPT_CONFIRMATION_CONCURRENCY || 6),
    retryPolicy:
      "Up to three attempts only for network failures, HTTP 408/429, and HTTP 5xx. Non-retryable HTTP, provider-envelope, and local contract failures cause no additional paid request. Three measured authentic requests (one per variant) must parse successfully before fan-out; a 12-result failure streak opens the circuit.",
    parserImplementation: "self-contained-production-contract-mirror-v1",
    inference:
      "Paired case-level bootstrap of candidate/baseline MAE ratios after averaging each case across three repetitions; 10,000 seeded resamples; two-sided percentile 95% interval (2.5th and 97.5th percentiles).",
    bootstrapIterations: 10_000,
    maximumCasesInAnyVariantRepetition: 100,
    totalAuthenticRequests: tasks.length,
    totalProviderAttempts: outcomes.reduce(
      (sum, outcome) => sum + (outcome.attemptCount ?? 0),
      0,
    ),
    userMessagePolicy:
      "Identical natural exact-100g food-log text across variants and repetitions; no evaluation instructions, expected values, or prompt policy added to user messages.",
    finalistSelectionRule:
      "Lowest calorie MAE among eligible prompt-only neutral, density-first, and compact variants in the frozen Foundation search summary; ties break by variant ID.",
    selectedPromptOnlyFinalist: finalistSelection.selected,
    eligibleSearchCandidates: finalistSelection.eligibleCandidates,
    variants: variants.map((variant) => ({
      id: variant.id,
      kind: variant.kind,
      promptHash: sha256(variant.template),
      promptTemplate: variant.template,
    })),
    datasetSha256: sha256(JSON.stringify(datasetSnapshot)),
  };
  const summary = summarize(outcomes, cases, variants, finalistSelection);

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

export {
  callModel,
  compactPrompt,
  createProviderFailureCircuit,
  densityFirstPrompt,
  makeConfirmationCases,
  makeFoundationCases,
  neutralPrompt,
  normalizedDescription,
  parseNutritionProviderResponse,
  retainedVariantCanaryIndexes,
  selectFinalist,
  sha256,
};

let invokedDirectly = false;
if (process.argv[1]) {
  try {
    invokedDirectly =
      realpathSync(resolve(process.argv[1])) ===
      realpathSync(fileURLToPath(import.meta.url));
  } catch {
    invokedDirectly = false;
  }
}
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
