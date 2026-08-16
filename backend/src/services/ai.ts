import { z } from "zod";
import type {
  AiModelPreference,
  MealType,
  NutritionGoal,
  PreferredLanguage,
} from "../contracts/common.ts";
import {
  ParsedFoodSuggestionSchema,
  type ParseFoodRequest,
} from "../contracts/ai-food.ts";
import { env } from "../env.ts";
import { configuredAiModelUri } from "./aiModel.ts";
import { sanitizeMealSlug } from "./slugShape.ts";

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

0. EXPLICIT USER VALUES HAVE HIGHEST PRIORITY
- Preserve every explicit portion, calorie, protein, carbohydrate, fat, and fiber value from the user's description exactly for the food it describes.
- Never replace, normalize, scale, or "correct" an explicit user value, even when it conflicts with a typical estimate or the calorie-to-macro formula.
- Estimate only values the user omitted. Use explicit values as constraints when estimating the missing fields.

1. FOOD GROUPING
- If the input is a recipe or mixed dish -> output ONE food item (the dish as a whole).
- DO NOT list individual ingredients as separate foods.
- If the input clearly lists separate foods eaten -> output multiple items.

2. PORTION
- Estimate portion size in grams when possible.
- Keep it short (e.g. "~350g", "1 bowl", "2 pcs").

3. NUTRITION CONSISTENCY (CRITICAL FOR INFERRED VALUES)
- For inferred values only, ensure internal consistency:
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
- fiber (g) — dietary fiber; required for every item (estimate if unsure).

6. SANITY CHECKS
- Large portions (>500g) should rarely be <600 kcal unless very low-fat
- Fat-heavy dishes must reflect fat in grams
- If meat is present -> protein should not be very low

7. OUTPUT
- Respond with a single JSON object
- No markdown, no comments, no extra text
- Every food MUST list fiber in nutrients (never omit fiber).

8. API FIELD ALIGNMENT
- The downstream API stores nutrients as:
  calories, protein, carbs, fats, fiber, portion
- In this structured output schema, keep:
  - "carbohydrates" as the carbohydrate field
  - "fat" as the fat field
- These will be mapped to API fields:
  carbohydrates -> carbs
  fat -> fats
  fiber -> fiber (grams)

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
- "log_day": resolved local calendar day in YYYY-MM-DD format. Timing instructions and defaults are supplied below.
- "meal_type": exactly one of "breakfast", "lunch", "dinner", or "snack". Timing instructions and defaults are supplied below.

11. MEAL SLUG (per food, API; for habit tracking + meal recommendations)
- Include "meal_slug" for every food.
- Format: lowercase ASCII letters and digits, words separated by single hyphens. Allowed chars: [a-z0-9-]. No spaces, no diacritics (transliterate first).
- Length: 1 to 4 hyphenated tokens (ideally 1–3), max 60 characters.
- Capture dish identity. Order tokens from most identifying to least: main item or key protein first, then defining qualifiers (sauce, style, preparation). Examples: "chicken-sandwich-grilled", "pasta-cream", "yogurt-fruit", "turkey-burger", "curd-honey", "latte".
- DROP irrelevant detail: quantities and units ("300g", "2x"), sizes ("large", "small", "double"), brand names, packaging, dates, locations, and adjectives like "homemade", "tasty", "fresh".
- DROP filler words ("with", "and", "of", "the", articles).
- ALWAYS in English even if "name" is in another language, so habits collapse across languages (e.g. "куриный сэндвич" → "chicken-sandwich", "творог с медом" → "curd-honey").
- Drinks, snacks, sauces, supplements are valid foods and should also be slugged.
- If a food cannot be identified at all, use exactly: unknown

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
      "confidence"?: number,
      "meal_slug": string,
      "log_day": "YYYY-MM-DD",
      "meal_type": "breakfast" | "lunch" | "dinner" | "snack"
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
        meal_slug: z.string().optional(),
        log_day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
      })
      .refine(
        (food) => {
          const names = new Set(food.nutrients.map((nutrient) => nutrient.name));
          return (
            names.has("calories") &&
            names.has("protein") &&
            names.has("fat") &&
            names.has("carbohydrates") &&
            names.has("fiber")
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

const PARSE_FOOD_CACHE_VERSION = "v7";
const parseFoodCache = new Map<string, ParseFoodCacheEntry>();
const parseFoodInFlight = new Map<string, Promise<ParsedFoodSuggestion[]>>();

/** Clears process-local parse state when an isolated E2E run resets its database. */
export function resetParseFoodInMemoryState(): void {
  parseFoodCache.clear();
  parseFoodInFlight.clear();
}

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
  name: "calories" | "protein" | "fat" | "carbohydrates" | "fiber",
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
  const model = configuredAiModelUri(aiModelPreference);
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

function normalizeParseFoodText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildParseFoodCacheKey(
  text: string,
  preferredLanguage: PreferredLanguage,
  nutritionGoal: NutritionGoal,
  aiModelPreference: AiModelPreference,
  timing: ParseFoodTimingContext,
): string {
  return [
    PARSE_FOOD_CACHE_VERSION,
    configuredAiModelUri(aiModelPreference),
    preferredLanguage,
    nutritionGoal,
    timing.localDate,
    timing.localTimeHm,
    timing.clientTimeZone,
    timing.defaultLogDay,
    timing.defaultMealType,
    normalizeParseFoodText(text),
  ].join(":");
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
  timing?: ParseFoodTimingContext,
): string {
  const langName = OUTPUT_LANGUAGE_NAMES[preferredLanguage];
  const goalHint = NUTRITION_GOAL_PARSER_HINTS[nutritionGoal];
  const timingContext = timing ?? {
    localDate: "2026-01-01",
    localTimeHm: "12:00",
    clientTimeZone: "UTC",
    defaultLogDay: "2026-01-01",
    defaultMealType: "lunch" as MealType,
  };
  return `${NutritionParserPrompt}

12. USER NUTRITION GOAL (ESTIMATION BIAS)
- ${goalHint}

13. OUTPUT LANGUAGE
- The "name" field, the "description" working notes, and "estimated_portion" must be in ${langName} (BCP-style tag: ${preferredLanguage}).
- "meal_slug" stays English regardless of this setting (see section 11).

14. LOG TIMING (PER FOOD)
- The user's current local calendar date and wall-clock time are ${timingContext.localDate} ${timingContext.localTimeHm} in IANA zone "${timingContext.clientTimeZone}".
- Every food MUST include "log_day" and "meal_type".
- Resolve explicit relative dates (for example today, yesterday, the day before yesterday, and their equivalents in any input language) against the local calendar date ${timingContext.localDate}. "Yesterday" is the previous calendar date even shortly after midnight.
- If no date is expressed for a food, use the app's default logging day: ${timingContext.defaultLogDay}.
- Resolve an explicitly named meal to exactly one API value: breakfast, lunch, dinner, or snack. Understand meal words in any input language (for example завтрак/обед/ужин/перекус).
- If the input gives a clock time or daypart instead of a meal name, map it using the app's buckets: 05:00–10:59 breakfast, 11:00–15:59 lunch, 16:00–21:59 dinner, and snack otherwise. An explicit meal name takes precedence over this clock mapping.
- If no meal is expressed for a food, use the default meal: ${timingContext.defaultMealType}.
- A timing phrase shared by a list applies to every food in that list. If separate clauses clearly give foods different dates or meals, assign each food its own values.
- Do not include date, time, or meal words in the food name or meal_slug unless they are genuinely part of the dish name.`;
}

export type ParseFoodTimingContext = Pick<
  ParseFoodRequest,
  "localDate" | "localTimeHm" | "clientTimeZone" | "defaultLogDay" | "defaultMealType"
>;

/** Validate and map a raw provider payload through the same production normalization path. */
export function parseNutritionProviderResponse(
  raw: string,
  timing: ParseFoodTimingContext,
): ParsedFoodSuggestion[] {
  const parsed = NutritionParserResponseSchema.parse(JSON.parse(extractFirstJsonObject(raw)));

  return parsed.foods.map((food) => {
    const trimmed = food.description?.trim();
    const conf =
      typeof food.confidence === "number" && Number.isFinite(food.confidence)
        ? Math.min(1, Math.max(0, food.confidence))
        : undefined;
    const slug = food.meal_slug ? sanitizeMealSlug(food.meal_slug) : null;
    return ParsedFoodSuggestionSchema.parse({
      name: food.name,
      ...(trimmed ? { description: trimmed } : {}),
      ...(conf !== undefined ? { confidence: conf } : {}),
      ...(slug ? { mealSlug: slug } : {}),
      calories: getNutrientAmount(food.nutrients, "calories"),
      protein: getNutrientAmount(food.nutrients, "protein"),
      carbs: getNutrientAmount(food.nutrients, "carbohydrates"),
      fats: getNutrientAmount(food.nutrients, "fat"),
      fiber: getNutrientAmount(food.nutrients, "fiber"),
      portion: food.estimated_portion ?? "1 serving",
      day: food.log_day ?? timing.defaultLogDay,
      mealType: food.meal_type ?? timing.defaultMealType,
    });
  });
}

async function generateParseFoodSuggestions(
  text: string,
  preferredLanguage: PreferredLanguage,
  nutritionGoal: NutritionGoal,
  aiModelPreference: AiModelPreference,
  timing: ParseFoodTimingContext,
): Promise<ParsedFoodSuggestion[]> {
  const raw = await aiChat(
    text,
    buildNutritionParserSystem(preferredLanguage, nutritionGoal, timing),
    aiModelPreference,
    { temperature: 0.1 },
  );
  return parseNutritionProviderResponse(raw, timing);
}

const MEAL_SLUG_PROMPT = [
  "You normalize food names into short canonical slugs for habit tracking and meal recommendations.",
  "",
  "OUTPUT (strict):",
  "- Reply with EXACTLY ONE slug and nothing else. No quotes, no surrounding punctuation, no explanation, no JSON.",
  "- Format: lowercase ASCII letters and digits, words separated by single hyphens. Allowed chars: [a-z0-9-]. No spaces, no diacritics (transliterate first).",
  "- Length: 1 to 4 hyphenated tokens (ideally 1–3), max 60 characters.",
  "- Capture dish identity. Order tokens from most identifying to least: main item or key protein first, then defining qualifiers (sauce, style, preparation). Examples: \"chicken-sandwich-grilled\", \"pasta-cream\", \"yogurt-fruit\", \"turkey-burger\", \"curd-honey\", \"latte\".",
  "- DROP irrelevant detail: quantities and units (\"300g\", \"2x\"), sizes (\"large\", \"small\", \"double\"), brand names, packaging, dates, locations, and adjectives like \"homemade\", \"tasty\", \"fresh\".",
  "- DROP filler words (\"with\", \"and\", \"of\", \"the\", articles).",
  "- TRANSLATE non-English inputs to English first so habits across languages collapse (e.g. \"куриный сэндвич\" → \"chicken-sandwich\", \"творог с медом\" → \"curd-honey\").",
  "- Drinks, snacks, sauces, supplements are valid foods and should also be slugged.",
  "- If the input is empty or clearly not a food, reply with exactly: unknown",
].join("\n");

/** Single short slug from any food name; safeguards live in the prompt. */
export async function generateMealSlugWithAi(
  name: string,
  aiModelPreference: AiModelPreference,
): Promise<string> {
  const raw = await aiChat(name, MEAL_SLUG_PROMPT, aiModelPreference, { temperature: 0 });
  return raw.trim();
}

const FiberEstimateResponseSchema = z.object({ fiber_g: z.number().nonnegative() });

/**
 * Given trusted logged macros, estimate dietary fiber via the same AI stack as parse-food.
 * Caps result at carbs (fiber cannot exceed total carbohydrates).
 */
export async function estimateFiberGramsWithAi(
  input: {
    name: string;
    portion: string | null;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  },
  aiModelPreference: AiModelPreference,
): Promise<number> {
  const user = [
    "Estimate dietary fiber (grams) for this single logged food. Calories and macros below are ground truth; only estimate fiber.",
    `name: ${input.name}`,
    `portion: ${input.portion?.trim() || "unknown"}`,
    `calories_kcal: ${input.calories}`,
    `protein_g: ${input.protein}`,
    `carbs_g: ${input.carbs}`,
    `fats_g: ${input.fats}`,
    "",
    'Reply with one JSON object only, no markdown: {"fiber_g": <number>}',
    "Rules: fiber_g >= 0, fiber_g <= carbs_g, realistic whole-food estimate.",
  ].join("\n");
  const system = "You output only valid JSON with a single key fiber_g. No prose, no markdown.";
  const raw = await aiChat(user, system, aiModelPreference, { temperature: 0.1 });
  const parsed = FiberEstimateResponseSchema.parse(JSON.parse(extractFirstJsonObject(raw)));
  const cap = Math.max(0, input.carbs);
  return Math.min(parsed.fiber_g, cap);
}

export async function parseFoodTextWithAi(
  text: string,
  preferredLanguage: PreferredLanguage,
  nutritionGoal: NutritionGoal,
  aiModelPreference: AiModelPreference,
  timing: ParseFoodTimingContext,
  options?: { skipCache?: boolean },
): Promise<ParsedFoodSuggestion[]> {
  const skipCache = options?.skipCache === true;
  const cacheKey = buildParseFoodCacheKey(
    text,
    preferredLanguage,
    nutritionGoal,
    aiModelPreference,
    timing,
  );

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
    timing,
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
