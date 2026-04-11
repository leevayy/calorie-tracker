import { z } from "zod";
import type {
  AiModelPreference,
  NutritionGoal,
  PreferredLanguage,
} from "../contracts/common.ts";
import { ParsedFoodSuggestionSchema } from "../contracts/ai-food.ts";
import { env } from "../env.ts";

const ChatCompletionSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }),
    }),
  ),
});

const NutritionParserPrompt = `You are a nutrition parser and estimator.

Your task:
Convert the user input into structured nutrition data.

STRICT RULES:

1. FOOD GROUPING
- If the input is a recipe or mixed dish -> output ONE food item (the dish as a whole).
- DO NOT list individual ingredients as separate foods.
- If the input clearly lists separate foods eaten -> output multiple items.

2. PORTION
- Estimate portion size in grams when possible.
- Keep it short (e.g. "~350g", "1 bowl", "2 pcs").

3. NUTRITION CONSISTENCY (CRITICAL)
- Ensure internal consistency:
  calories ~= protein*4 + carbs*4 + fat*9
- If mismatch >10%, FIX the numbers.
- NEVER output unrealistically low fat for fatty foods (e.g. mince, cheese).

4. ESTIMATION LOGIC
- Use typical real-world values:
  - minced meat 15-20% fat unless specified
  - cooked potatoes ~70-80 kcal / 100g
  - cheese ~350-400 kcal / 100g
- If recipe is given, estimate TOTAL dish nutrition first, then scale to portion.

5. REQUIRED NUTRIENTS
Always include:
- calories (kcal)
- protein (g)
- fat (g)
- carbohydrates (g)

Optional:
- fiber (g)

6. SANITY CHECKS
- Large portions (>500g) should rarely be <600 kcal unless very low-fat
- Fat-heavy dishes must reflect fat in grams
- If meat is present -> protein should not be very low

7. OUTPUT
- Respond with a single JSON object
- No markdown, no comments, no extra text
- In nutrients, fiber is optional and may be omitted.

8. API FIELD ALIGNMENT
- The downstream API stores nutrients as:
  calories, protein, carbs, fats, portion
- In this structured output schema, keep:
  - "carbohydrates" as the carbohydrate field
  - "fat" as the fat field
- These will be mapped to API fields:
  carbohydrates -> carbs
  fat -> fats

9. REFERENCE NUTRITION DATA (FEW-SHOT EXAMPLES)
- The user message MAY contain a [REFERENCE] ... [END REFERENCE] block before the actual food text.
- This block contains verified nutrition data the user manually curated.
- When a food in the user's input matches or closely resembles a reference entry, you MUST use the reference values as ground truth.
- Adjust only for portion differences (e.g., if reference is per 100g and user says 200g, double the values).
- When the food does NOT match any reference entry, estimate normally using rules 1-6.
- NEVER invent or hallucinate reference entries; only use what is given.
- Each reference entry shows: food name -> expected JSON output. Mimic this pattern precisely.

10. PER-ITEM METADATA (API; required shape for this app)
- "name": short, clean label for what was eaten (user-facing).
- "description": brief internal notes (portion assumptions, ambiguity, interpretation). Keep concise.
- "confidence": number from 0 to 1 (subjective certainty). Include whenever possible for the client UI.
- "estimated_portion" optional; same language as name/description.

Schema:
{
  "foods": [
    {
      "name": string,
      "description": string,
      "estimated_portion"?: string,
      "nutrients": [
        { "name": "calories", "amount": number, "unit": "kcal" },
        { "name": "protein", "amount": number, "unit": "g" },
        { "name": "fat", "amount": number, "unit": "g" },
        { "name": "carbohydrates", "amount": number, "unit": "g" },
        { "name": "fiber", "amount": number, "unit": "g" }
      ],
      "confidence"?: number
    }
  ],
  "notes"?: string
}`;

const NutrientSchema = z.object({
  name: z.enum(["calories", "protein", "fat", "carbohydrates", "fiber"]),
  amount: z.number().nonnegative(),
  unit: z.enum(["kcal", "g"]),
});

const NutritionParserResponseSchema = z.object({
  foods: z.array(
    z
      .object({
        name: z.string().min(1),
        description: z.string().optional(),
        estimated_portion: z.string().min(1).optional(),
        nutrients: z.array(NutrientSchema),
        confidence: z.number().min(0).max(1).optional(),
      })
      .refine(
        (food) => {
          const names = new Set(food.nutrients.map((nutrient) => nutrient.name));
          return (
            names.has("calories") &&
            names.has("protein") &&
            names.has("fat") &&
            names.has("carbohydrates")
          );
        },
        { message: "Missing required nutrients" },
      ),
  ),
  notes: z.string().optional(),
});

type ParsedFoodSuggestion = z.infer<typeof ParsedFoodSuggestionSchema>;
type ParseFoodCacheEntry = {
  expiresAtMs: number;
  suggestions: ParsedFoodSuggestion[];
};

const PARSE_FOOD_CACHE_VERSION = "v4";
const parseFoodCache = new Map<string, ParseFoodCacheEntry>();
const parseFoodInFlight = new Map<string, Promise<ParsedFoodSuggestion[]>>();

function extractFirstJsonObject(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0 || end < start) {
    throw new Error("AI did not return JSON");
  }
  return raw.slice(start, end + 1);
}

function getNutrientAmount(
  nutrients: Array<z.infer<typeof NutrientSchema>>,
  name: "calories" | "protein" | "fat" | "carbohydrates",
): number {
  const nutrient = nutrients.find((item) => item.name === name);
  if (!nutrient) {
    throw new Error(`Required nutrient missing: ${name}`);
  }
  return nutrient.amount;
}

async function aiChat(
  prompt: string,
  system: string,
  aiModelPreference: AiModelPreference,
  options?: { temperature?: number },
): Promise<string> {
  const apiKey = env.YANDEX_AI_STUDIO_API_KEY;
  if (!apiKey) {
    throw new Error("Yandex AI Studio API key is missing");
  }

  const authorizationHeader = apiKey.startsWith("AQVN")
    ? `Api-Key ${apiKey}`
    : `Bearer ${apiKey}`;
  const model = resolveModelUriForPreference(aiModelPreference);
  const defaultHeaders: HeadersInit = {
    Authorization: authorizationHeader,
    "Content-Type": "application/json",
  };
  if (env.YANDEX_FOLDER_ID) {
    defaultHeaders["x-folder-id"] = env.YANDEX_FOLDER_ID;
  }

  const response = await fetch(env.YANDEX_AI_STUDIO_URL, {
    method: "POST",
    headers: defaultHeaders,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: options?.temperature ?? 0.2,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI upstream error: ${response.status} ${body}`);
  }

  const json = ChatCompletionSchema.parse(await response.json());
  return json.choices[0]?.message.content ?? "";
}

function modelIdForPreference(pref: AiModelPreference): string {
  switch (pref) {
    case "qwen3":
      return env.YANDEX_AI_STUDIO_MODEL_QWEN3;
    case "gptoss":
      return env.YANDEX_AI_STUDIO_MODEL_GPT_OSS;
    case "alicegpt":
      return env.YANDEX_AI_STUDIO_MODEL_ALICE_GPT;
    default:
      return env.YANDEX_AI_STUDIO_MODEL;
  }
}

function resolveModelUriFromModelId(modelId: string): string {
  if (modelId.startsWith("gpt://")) {
    return modelId;
  }
  if (env.YANDEX_FOLDER_ID) {
    return `gpt://${env.YANDEX_FOLDER_ID}/${modelId}`;
  }
  return modelId;
}

function resolveModelUriForPreference(pref: AiModelPreference): string {
  return resolveModelUriFromModelId(modelIdForPreference(pref));
}

function normalizeParseFoodText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildParseFoodCacheKey(
  text: string,
  preferredLanguage: PreferredLanguage,
  nutritionGoal: NutritionGoal,
  aiModelPreference: AiModelPreference,
): string {
  return `${PARSE_FOOD_CACHE_VERSION}:${resolveModelUriForPreference(aiModelPreference)}:${preferredLanguage}:${nutritionGoal}:${normalizeParseFoodText(text)}`;
}

function cloneSuggestions(suggestions: ParsedFoodSuggestion[]): ParsedFoodSuggestion[] {
  return suggestions.map((item) => ({ ...item }));
}

function getCachedParseFoodSuggestions(cacheKey: string): ParsedFoodSuggestion[] | null {
  const cached = parseFoodCache.get(cacheKey);
  if (!cached) return null;

  if (cached.expiresAtMs <= Date.now()) {
    parseFoodCache.delete(cacheKey);
    return null;
  }

  return cloneSuggestions(cached.suggestions);
}

function setCachedParseFoodSuggestions(cacheKey: string, suggestions: ParsedFoodSuggestion[]): void {
  if (parseFoodCache.has(cacheKey)) {
    parseFoodCache.delete(cacheKey);
  }

  const maxEntries = env.PARSE_FOOD_CACHE_MAX_ENTRIES;
  while (parseFoodCache.size >= maxEntries) {
    const oldestKey = parseFoodCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    parseFoodCache.delete(oldestKey);
  }

  parseFoodCache.set(cacheKey, {
    expiresAtMs: Date.now() + env.PARSE_FOOD_CACHE_TTL_SECONDS * 1000,
    suggestions: cloneSuggestions(suggestions),
  });
}

const OUTPUT_LANGUAGE_NAMES: Record<PreferredLanguage, string> = {
  en: "English",
  ru: "Russian",
  pl: "Polish",
  tt: "Tatar",
  kk: "Kazakh",
};

/** English hints for the parser; food "name" / "description" / portion language is governed by section 12. */
const NUTRITION_GOAL_PARSER_HINTS: Record<NutritionGoal, string> = {
  maintain:
    "User goal: maintain weight and general health. Prefer balanced, varied estimates; do not assume extreme restriction unless the food clearly warrants it.",
  muscle_gain:
    "User goal: gain muscle (caloric surplus). Favor realistic high-protein plates with adequate dietary fat when estimating mixed meals; avoid systematically underestimating energy for ambiguous portions.",
  fat_loss:
    "User goal: fat loss (caloric deficit). When portions are vague, lean slightly conservative on calories while staying honest for obviously energy-dense foods.",
  recomposition:
    "User goal: recomposition (typically mild deficit, high protein). Emphasize protein-forward estimates and moderate healthy fats; do not inflate calories for clearly lean meals.",
};

export function buildNutritionParserSystem(
  preferredLanguage: PreferredLanguage,
  nutritionGoal: NutritionGoal,
): string {
  const langName = OUTPUT_LANGUAGE_NAMES[preferredLanguage];
  const goalHint = NUTRITION_GOAL_PARSER_HINTS[nutritionGoal];
  return `${NutritionParserPrompt}

11. USER NUTRITION GOAL (ESTIMATION BIAS)
- ${goalHint}

12. OUTPUT LANGUAGE
- The "name" field, the "description" working notes, and "estimated_portion" must be in ${langName} (BCP-style tag: ${preferredLanguage}).`;
}

async function generateParseFoodSuggestions(
  text: string,
  preferredLanguage: PreferredLanguage,
  nutritionGoal: NutritionGoal,
  aiModelPreference: AiModelPreference,
): Promise<ParsedFoodSuggestion[]> {
  const raw = await aiChat(
    text,
    buildNutritionParserSystem(preferredLanguage, nutritionGoal),
    aiModelPreference,
    { temperature: 0.1 },
  );
  const parsed = NutritionParserResponseSchema.parse(JSON.parse(extractFirstJsonObject(raw)));

  return parsed.foods.map((food) => {
    const trimmed = food.description?.trim();
    const conf =
      typeof food.confidence === "number" && Number.isFinite(food.confidence)
        ? Math.min(1, Math.max(0, food.confidence))
        : undefined;
    return ParsedFoodSuggestionSchema.parse({
      name: food.name,
      ...(trimmed ? { description: trimmed } : {}),
      ...(conf !== undefined ? { confidence: conf } : {}),
      calories: getNutrientAmount(food.nutrients, "calories"),
      protein: getNutrientAmount(food.nutrients, "protein"),
      carbs: getNutrientAmount(food.nutrients, "carbohydrates"),
      fats: getNutrientAmount(food.nutrients, "fat"),
      portion: food.estimated_portion ?? "1 serving",
    });
  });
}

export async function parseFoodTextWithAi(
  text: string,
  preferredLanguage: PreferredLanguage,
  nutritionGoal: NutritionGoal,
  aiModelPreference: AiModelPreference,
  options?: { skipCache?: boolean },
): Promise<ParsedFoodSuggestion[]> {
  const skipCache = options?.skipCache === true;
  const cacheKey = buildParseFoodCacheKey(text, preferredLanguage, nutritionGoal, aiModelPreference);

  if (!skipCache) {
    const cached = getCachedParseFoodSuggestions(cacheKey);
    if (cached) {
      return cached;
    }

    const inFlight = parseFoodInFlight.get(cacheKey);
    if (inFlight) {
      return cloneSuggestions(await inFlight);
    }
  }

  const requestPromise = generateParseFoodSuggestions(
    text,
    preferredLanguage,
    nutritionGoal,
    aiModelPreference,
  );

  if (!skipCache) {
    parseFoodInFlight.set(cacheKey, requestPromise);
  }

  try {
    const suggestions = await requestPromise;
    if (!skipCache) {
      setCachedParseFoodSuggestions(cacheKey, suggestions);
    }
    return cloneSuggestions(suggestions);
  } finally {
    if (!skipCache) {
      parseFoodInFlight.delete(cacheKey);
    }
  }
}

export type RecentLog = {
  timestamp: string;
  calories: number;
  proteinG?: number;
  carbsG?: number;
  fatsG?: number;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
};

export type TipContext = {
  date: string;
  consumedCalories: number;
  calorieGoal: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
  weeklyAverageCalories: number | null;
  communityAvgCalories: number | null;
  clientTimeZone: string;
  localTimeHm: string;
  preferredLanguage: PreferredLanguage;
  nutritionGoal: NutritionGoal;
  /** Last 24–72h window, typically 5–10 most recent entries (newest last). */
  recentLogs: RecentLog[];
};

export type BehaviorSignals = {
  hoursSinceLastMeal: number | null;
  mealsToday: number;
  lastMealCalories: number | null;
  avgProteinRecent: number | null;
  lowProteinStreak: boolean;
  lateDayEatingPattern: boolean;
  undereatingTrend: boolean;
  erraticEating: boolean;
};

export type PrimaryInsight = {
  type: string;
  confidence: number;
};

const TIP_CONFIDENCE_THRESHOLD = 0.6;
const TIP_MAX_CHARS = 220;
const PROTEIN_LOW_G = 20;
const LATE_LOCAL_HOUR = 18;
const LATE_CAL_FRACTION = 0.55;
const UNDER_EAT_GOAL_RATIO = 0.78;
const ERRATIC_CAL_CV = 0.5;
const ERRATIC_GAP_STDEV_H = 4;

function localCalendarFields(
  instant: Date,
  timeZone: string,
): { ymd: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const y = map.year ?? "1970";
  const mo = map.month ?? "01";
  const d = map.day ?? "01";
  return {
    ymd: `${y}-${mo}-${d}`,
    hour: Number.parseInt(map.hour ?? "0", 10),
    minute: Number.parseInt(map.minute ?? "0", 10),
  };
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  return Math.sqrt(mean(nums.map((x) => (x - m) ** 2)));
}

export function deriveBehaviorSignals(context: TipContext, now: Date = new Date()): BehaviorSignals {
  const logs = [...context.recentLogs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const tz = context.clientTimeZone;

  if (logs.length === 0) {
    return {
      hoursSinceLastMeal: null,
      mealsToday: 0,
      lastMealCalories: null,
      avgProteinRecent: null,
      lowProteinStreak: false,
      lateDayEatingPattern: false,
      undereatingTrend: false,
      erraticEating: false,
    };
  }

  const last = logs[logs.length - 1]!;
  const lastTs = new Date(last.timestamp);
  const hoursSinceLastMeal = Number.isFinite(lastTs.getTime())
    ? Math.max(0, (now.getTime() - lastTs.getTime()) / 3_600_000)
    : null;

  let mealsToday = 0;
  for (const log of logs) {
    const { ymd } = localCalendarFields(new Date(log.timestamp), tz);
    if (ymd === context.date) mealsToday += 1;
  }

  const proteinVals = logs
    .map((l) => (typeof l.proteinG === "number" && Number.isFinite(l.proteinG) ? l.proteinG : null))
    .filter((x): x is number => x !== null);
  const avgProteinRecent = proteinVals.length > 0 ? mean(proteinVals) : null;

  const lastDesc = [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const lastThreeProt = lastDesc
    .slice(0, 3)
    .map((l) => (typeof l.proteinG === "number" && Number.isFinite(l.proteinG) ? l.proteinG : null))
    .filter((x): x is number => x !== null);
  let lowProteinStreak = false;
  if (lastThreeProt.length >= 2) {
    const check = lastThreeProt.slice(0, Math.min(3, lastThreeProt.length));
    lowProteinStreak = check.length >= 2 && check.every((p) => p < PROTEIN_LOW_G);
  }

  let totalCals = 0;
  let lateCals = 0;
  for (const log of logs) {
    const { hour } = localCalendarFields(new Date(log.timestamp), tz);
    totalCals += log.calories;
    if (hour >= LATE_LOCAL_HOUR) lateCals += log.calories;
  }
  const lateDayEatingPattern =
    totalCals >= 400 && lateCals / totalCals >= LATE_CAL_FRACTION;

  let undereatingTrend = false;
  if (
    context.weeklyAverageCalories !== null &&
    context.weeklyAverageCalories < context.calorieGoal * UNDER_EAT_GOAL_RATIO
  ) {
    undereatingTrend = true;
  } else {
    const byDay = new Map<string, number>();
    for (const log of logs) {
      const { ymd } = localCalendarFields(new Date(log.timestamp), tz);
      byDay.set(ymd, (byDay.get(ymd) ?? 0) + log.calories);
    }
    const dailyTotals = [...byDay.values()];
    if (dailyTotals.length >= 2) {
      const avgDay = mean(dailyTotals);
      if (avgDay < context.calorieGoal * 0.75) undereatingTrend = true;
    }
  }

  let erraticEating = false;
  if (logs.length >= 4) {
    const calsOnly = logs.map((l) => l.calories);
    const m = mean(calsOnly);
    const cv = m > 0 ? stdDev(calsOnly) / m : 0;
    if (cv >= ERRATIC_CAL_CV) erraticEating = true;
  }
  if (!erraticEating && logs.length >= 3) {
    const sorted = [...logs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const gapsH: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const dt =
        (new Date(sorted[i]!.timestamp).getTime() - new Date(sorted[i - 1]!.timestamp).getTime()) /
        3_600_000;
      if (Number.isFinite(dt) && dt > 0) gapsH.push(dt);
    }
    if (gapsH.length >= 2 && stdDev(gapsH) >= ERRATIC_GAP_STDEV_H) erraticEating = true;
  }

  return {
    hoursSinceLastMeal,
    mealsToday,
    lastMealCalories: typeof last.calories === "number" ? last.calories : null,
    avgProteinRecent,
    lowProteinStreak,
    lateDayEatingPattern,
    undereatingTrend,
    erraticEating,
  };
}

function confidenceFromLogs(logCount: number, strength: number): number {
  const dataFactor = 0.5 + 0.5 * Math.min(1, logCount / 5);
  return Math.round(Math.min(1, strength * dataFactor) * 100) / 100;
}

export function pickPrimaryInsight(
  context: TipContext,
  signals: BehaviorSignals,
  dayFrac: number,
): PrimaryInsight {
  const n = context.recentLogs.length;
  const rawDelta = context.calorieGoal - context.consumedCalories;

  const longFast =
    n >= 1 &&
    signals.hoursSinceLastMeal !== null &&
    signals.hoursSinceLastMeal >= 12 &&
    dayFrac >= 0.42 &&
    (signals.mealsToday === 0 || signals.hoursSinceLastMeal >= 14);
  const noMealsTodayLate = n >= 1 && signals.mealsToday === 0 && dayFrac >= 0.45;
  if (longFast || noMealsTodayLate) {
    const strength = noMealsTodayLate && dayFrac >= 0.55 ? 0.92 : longFast ? 0.85 : 0.72;
    return { type: "fasting_late_day", confidence: confidenceFromLogs(n, strength) };
  }

  if (dayFrac >= 0.55 && rawDelta > context.calorieGoal * 0.35) {
    return { type: "large_deficit_late_day", confidence: confidenceFromLogs(n, 0.8) };
  }

  if (signals.lowProteinStreak) {
    return { type: "low_protein_pattern", confidence: confidenceFromLogs(n, 0.74) };
  }

  if (signals.lateDayEatingPattern) {
    return { type: "late_day_eating", confidence: confidenceFromLogs(n, 0.64) };
  }

  if (signals.undereatingTrend) {
    return { type: "undereating_trend", confidence: confidenceFromLogs(n, 0.62) };
  }

  if (signals.erraticEating) {
    return { type: "erratic_eating", confidence: confidenceFromLogs(n, 0.58) };
  }

  return { type: "goal_balance_generic", confidence: confidenceFromLogs(n, 0.44) };
}

function takeFirstSentence(text: string): string {
  const t = text.trim();
  const m = t.match(/^[\s\S]+?[.!?](?=\s|$)/);
  return m ? m[0].trim() : t;
}

function validateAndClampTipText(raw: string): string {
  let t = takeFirstSentence(raw).replace(/\s+/g, " ").trim();
  if (!t) return t;
  if (t.length > TIP_MAX_CHARS) {
    t = `${t.slice(0, TIP_MAX_CHARS - 1).trimEnd()}…`;
  }
  return t;
}

/** Turns English-only factual summary into one sentence in the user's language via AI. Falls back to English if the call fails. */
export async function localizeTipWithAi(
  englishDraft: string,
  preferredLanguage: PreferredLanguage,
  aiModelPreference: AiModelPreference,
): Promise<string> {
  const clampedEnglish = validateAndClampTipText(englishDraft);
  if (!clampedEnglish.trim()) return "";
  if (preferredLanguage === "en") {
    return clampedEnglish;
  }
  const langName = OUTPUT_LANGUAGE_NAMES[preferredLanguage];
  const system = [
    `You are a concise calorie tracking coach.`,
    `Rewrite the following English summary into exactly ONE short sentence in ${langName} (language tag: ${preferredLanguage}).`,
    `Preserve all numbers, percentages, and comparisons accurately.`,
    `Sound natural and supportive, like a human coach.`,
    `At most ${TIP_MAX_CHARS} characters.`,
    `Do not include markdown, bullet points, or multiple sentences.`,
  ].join("\n");
  try {
    const raw = await aiChat(clampedEnglish, system, aiModelPreference);
    const validated = validateAndClampTipText(raw);
    if (validated.trim()) return validated;
  } catch {
    // use English below
  }
  return clampedEnglish;
}

function insightCoachNote(type: string): string {
  switch (type) {
    case "fasting_late_day":
      return "Long gap since eating and/or no meals logged today while the local day is well underway; prioritize a timely meal.";
    case "large_deficit_late_day":
      return "Calorie intake is far under goal late in the local day; suggest a realistic way to close the gap without shame.";
    case "low_protein_pattern":
      return "Recent entries show consistently low protein; suggest a concrete protein add-on.";
    case "late_day_eating":
      return "Most calories cluster late (evening); suggest a small shift (e.g., earlier snack or front-loading).";
    case "undereating_trend":
      return "Recent days average under the calorie goal; suggest a gentle, sustainable bump.";
    case "erratic_eating":
      return "Meal sizes or timing swing a lot; suggest stabilizing with one simple habit.";
    default:
      return "Ground the tip in calorie goal vs intake and the user's nutrition goal; one practical nudge.";
  }
}

const NUTRITION_GOAL_TIP_COACH_HINTS: Record<NutritionGoal, string> = {
  maintain: "They want balanced eating and general health; keep advice practical and sustainable.",
  muscle_gain:
    "They are building muscle (surplus); encourage enough calories and protein without shaming appetite.",
  fat_loss: "They are losing fat (deficit); be supportive about hunger and protein-forward choices.",
  recomposition:
    "They want recomposition (deficit + high protein); nudge protein and training recovery, not extreme cuts.",
};

function parseLocalHm(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

/** Fraction of local calendar day elapsed at `localTimeHm` (0–1). */
function fractionOfLocalDayElapsed(localTimeHm: string): number {
  const { h, m } = parseLocalHm(localTimeHm);
  return Math.min(1, Math.max(0, (h * 60 + m) / (24 * 60)));
}

export async function generateTipMessageWithAi(
  context: TipContext,
  aiModelPreference: AiModelPreference,
): Promise<string> {
  const signals = deriveBehaviorSignals(context);
  const dayFrac = fractionOfLocalDayElapsed(context.localTimeHm);
  const primaryInsight = pickPrimaryInsight(context, signals, dayFrac);

  const bypassBehaviorAi =
    context.recentLogs.length === 0 || primaryInsight.confidence < TIP_CONFIDENCE_THRESHOLD;
  if (bypassBehaviorAi) {
    return localizeTipWithAi(
      buildEnglishFallbackTipMessage(context),
      context.preferredLanguage,
      aiModelPreference,
    );
  }

  const langName = OUTPUT_LANGUAGE_NAMES[context.preferredLanguage];
  const goalLine = NUTRITION_GOAL_TIP_COACH_HINTS[context.nutritionGoal];
  const payload = {
    context,
    signals,
    primaryInsight,
  };
  const highLogConfidence = primaryInsight.confidence >= 0.75;
  const system = [
    `You are a concise calorie tracking coach.`,
    `Write the entire tip in ${langName} (language tag: ${context.preferredLanguage}).`,
    `Nutrition goal context: ${goalLine}`,
    `The user's logged calendar day is ${context.date}. Their local clock is ${context.localTimeHm} in IANA zone "${context.clientTimeZone}".`,
    `About ${Math.round(dayFrac * 100)}% of their local day has passed (from local midnight to local time).`,
    `Structured preprocessing already picked a primary insight (type "${primaryInsight.type}", confidence ${primaryInsight.confidence.toFixed(2)}).`,
    `Focus the tip on that insight: ${insightCoachNote(primaryInsight.type)}`,
    highLogConfidence
      ? `You may use fields in "recentLogs" in context for specifics (timing, meal type, macros).`
      : `Rely mainly on summary fields and signals; use recentLogs only lightly since confidence is moderate.`,
    `Return exactly ONE short sentence, at most ${TIP_MAX_CHARS} characters.`,
    `When confidence is high (>= ~0.75), include ONE concrete next action (food choice, timing, or macro tweak).`,
    `When confidence is moderate, stay safe and general but still practical.`,
    `Phrase it like a human coach: natural imperatives or gentle suggestions in ${langName}, with a doable step whenever the insight is specific—do not answer with diagnosis-only commentary.`,
    `Do not include markdown, bullet points, or multiple sentences.`,
  ].join("\n");

  const raw = await aiChat(JSON.stringify(payload), system, aiModelPreference);
  const validated = validateAndClampTipText(raw);
  if (!validated.trim()) {
    return localizeTipWithAi(
      buildEnglishFallbackTipMessage(context),
      context.preferredLanguage,
      aiModelPreference,
    );
  }
  return validated;
}

/** Deterministic English facts for tips when behavior insight is skipped or as input for {@link localizeTipWithAi}. Not locale-specific copy for the UI. */
export function buildEnglishFallbackTipMessage(context: TipContext): string {
  const pct = Math.round((context.consumedCalories / context.calorieGoal) * 100);
  const rawDelta = context.calorieGoal - context.consumedCalories;
  const delta = Math.round(Math.abs(rawDelta));
  const deltaText =
    rawDelta >= 0 ? `${delta} kcal below your goal` : `${delta} kcal above your goal`;
  const macroLow = context.proteinG < 60;
  const macroTip = macroLow
    ? "Consider adding protein in your next meal."
    : "Your protein intake looks solid today.";
  const communityText =
    context.communityAvgCalories == null
      ? ""
      : ` People in your cohort average ${Math.round(context.communityAvgCalories)} kcal today.`;
  let base = `${pct}% of goal, ${deltaText}. ${macroTip}${communityText}`.trim();
  const dayFrac = fractionOfLocalDayElapsed(context.localTimeHm);
  if (dayFrac >= 0.55 && rawDelta > context.calorieGoal * 0.35) {
    base += " It's getting late locally — plan a solid meal so you don't finish the day short.";
  }
  base += " Log your next meal so tips stay on target.";
  return base;
}
