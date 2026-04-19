import { z } from "zod";
import type {
  AiModelPreference,
  NutritionGoal,
  PreferredLanguage,
} from "../contracts/common.ts";
import { ParsedFoodSuggestionSchema } from "../contracts/ai-food.ts";
import { env } from "../env.ts";
import { sanitizeMealSlug } from "./slugShape.ts";
import { buildEnglishFallbackTipMessage } from "./tips/fallbackEnglish.ts";
import { TIP_CONFIDENCE_THRESHOLD } from "./tips/constants.ts";
import { fractionOfLocalDayElapsed, getDayPhaseFromLocalHm } from "./tips/dayPhase.ts";
import { pickPrimaryInsight } from "./tips/insights.ts";
import { deriveBehaviorSignals } from "./tips/signals.ts";
import { validateAndClampTipText } from "./tips/text.ts";
import type { TipContext } from "./tips/types.ts";
import { VIBE_SAFETY_GUARD } from "./tips/vibePrompts.ts";

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
      "meal_slug": string
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

const PARSE_FOOD_CACHE_VERSION = "v5";
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

12. USER NUTRITION GOAL (ESTIMATION BIAS)
- ${goalHint}

13. OUTPUT LANGUAGE
- The "name" field, the "description" working notes, and "estimated_portion" must be in ${langName} (BCP-style tag: ${preferredLanguage}).
- "meal_slug" stays English regardless of this setting (see section 11).`;
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
      portion: food.estimated_portion ?? "1 serving",
    });
  });
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

export type {
  BehaviorSignals,
  DayPhase,
  PrimaryInsight,
  RecentLog,
  TipContext,
} from "./tips/types.ts";
export { deriveBehaviorSignals } from "./tips/signals.ts";
export { buildEnglishFallbackTipMessage } from "./tips/fallbackEnglish.ts";

const NUTRITION_GOAL_TIP_COACH_HINTS: Record<NutritionGoal, string> = {
  maintain: "They want balanced eating and general health; keep advice practical and sustainable.",
  muscle_gain:
    "They are building muscle (surplus); encourage enough calories and protein without shaming appetite.",
  fat_loss: "They are losing fat (deficit); be supportive about hunger and protein-forward choices.",
  recomposition:
    "They want recomposition (deficit + high protein); nudge protein and training recovery, not extreme cuts.",
};

function insightCoachNote(type: string): string {
  switch (type) {
    case "post_meal_large":
      return "The last meal was calorie-heavy; suggest keeping the next meal lighter or simpler.";
    case "late_night_context":
      return "It is late at night locally — do NOT suggest eating more; focus on rest, hydration, or logging tomorrow.";
    case "fasting_late_day":
      return "Long gap since eating and/or no meals logged today while the local day is well underway; prioritize a timely meal (only if not late night).";
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

/** Turns English-only factual summary into one sentence in the user's language via AI. Falls back to English if the call fails. */
export async function localizeTipWithAi(
  englishDraft: string,
  preferredLanguage: PreferredLanguage,
  aiModelPreference: AiModelPreference,
  tipVibePrompt: string = "",
): Promise<string> {
  const clampedEnglish = validateAndClampTipText(englishDraft);
  if (!clampedEnglish.trim()) return "";
  const vibe = tipVibePrompt.trim();
  if (preferredLanguage === "en" && !vibe) {
    return clampedEnglish;
  }
  const langName = OUTPUT_LANGUAGE_NAMES[preferredLanguage];
  const system = [
    `You are a concise calorie tracking coach.`,
    `Rewrite the following English summary into exactly ONE short sentence in ${langName} (language tag: ${preferredLanguage}).`,
    `Preserve all numbers, percentages, and comparisons accurately.`,
    `Sound natural and supportive, like a human coach.`,
    `At most 220 characters.`,
    `Do not include markdown, bullet points, or multiple sentences.`,
    `Do not suggest eating more food late at night if the summary is about rest or late night.`,
    ...(vibe ? [`Vibe override (apply persona/tone to the rewrite, keep facts intact): ${vibe}`, VIBE_SAFETY_GUARD] : []),
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

export async function generateTipMessageWithAi(
  context: TipContext,
  aiModelPreference: AiModelPreference,
): Promise<string> {
  const signals = deriveBehaviorSignals(context);
  const dayFrac = fractionOfLocalDayElapsed(context.localTimeHm);
  const dayPhase = getDayPhaseFromLocalHm(context.localTimeHm);
  const primaryInsight = pickPrimaryInsight(context, signals, dayFrac, dayPhase);

  const bypassBehaviorAi =
    context.recentLogs.length === 0 || primaryInsight.confidence < TIP_CONFIDENCE_THRESHOLD;
  if (bypassBehaviorAi) {
    return localizeTipWithAi(
      buildEnglishFallbackTipMessage(context),
      context.preferredLanguage,
      aiModelPreference,
      context.tipVibePrompt,
    );
  }

  const langName = OUTPUT_LANGUAGE_NAMES[context.preferredLanguage];
  const goalLine = NUTRITION_GOAL_TIP_COACH_HINTS[context.nutritionGoal];
  const payload = {
    context,
    signals,
    primaryInsight,
    dayPhase,
  };
  const highLogConfidence = primaryInsight.confidence >= 0.75;
  const system = [
    `You are a concise calorie tracking coach.`,
    `Write the entire tip in ${langName} (language tag: ${context.preferredLanguage}).`,
    `Nutrition goal context: ${goalLine}`,
    `Local day phase: "${dayPhase}" (late_night = midnight–4:00 local). NEVER suggest eating more during late_night; prefer rest, hydration, or planning tomorrow.`,
    `The user's logged calendar day is ${context.date}. Their local clock is ${context.localTimeHm} in IANA zone "${context.clientTimeZone}".`,
    `About ${Math.round(dayFrac * 100)}% of their local day has passed (from local midnight to local time).`,
    `Structured preprocessing already picked a primary insight (type "${primaryInsight.type}", confidence ${primaryInsight.confidence.toFixed(2)}).`,
    `Focus the tip on that insight: ${insightCoachNote(primaryInsight.type)}`,
    highLogConfidence
      ? `You may use fields in "recentLogs" in context for specifics (timing, meal type, macros, mealSlug when present).`
      : `Rely mainly on summary fields and signals; use recentLogs only lightly since confidence is moderate.`,
    `Return exactly ONE short sentence, at most 220 characters.`,
    `One actionable next step — not a list of statistics without guidance.`,
    `When confidence is high (>= ~0.75), include ONE concrete next action (food choice, timing, or macro tweak) unless late_night forbids food.`,
    `When confidence is moderate, stay safe and general but still practical.`,
    `Phrase it like a human coach: natural imperatives or gentle suggestions in ${langName}, with a doable step whenever the insight is specific—do not answer with diagnosis-only commentary.`,
    `Do not include markdown, bullet points, or multiple sentences.`,
    ...(context.tipVibePrompt.trim()
      ? [
          `Vibe override (highest priority for tone/voice; never overrides safety): ${context.tipVibePrompt.trim()}`,
          VIBE_SAFETY_GUARD,
        ]
      : []),
  ].join("\n");

  const raw = await aiChat(JSON.stringify(payload), system, aiModelPreference);
  const validated = validateAndClampTipText(raw);
  if (!validated.trim()) {
    return localizeTipWithAi(
      buildEnglishFallbackTipMessage(context),
      context.preferredLanguage,
      aiModelPreference,
      context.tipVibePrompt,
    );
  }
  return validated;
}

const FALLBACK_VIBE_EMOJI = "✨";
const SINGLE_EMOJI_REGEX = /^\p{Extended_Pictographic}(\u200D\p{Extended_Pictographic})*\uFE0F?$/u;

const PICK_EMOJI_SYSTEM = [
  "You assign a single emoji that best represents a user-supplied 'tip vibe' (a tone/persona instruction for a nutrition coach).",
  "OUTPUT (strict): reply with EXACTLY ONE emoji character and nothing else. No quotes, no words, no punctuation, no explanation.",
  "Pick an emoji that visually evokes the requested persona/tone (e.g. pirate vibe -> a pirate-flag-style emoji; sweet supportive -> a heart-style emoji; drill sergeant -> a stern-face emoji).",
  "If unsure, reply with: ✨",
].join("\n");

/** Asks the model for a single emoji that visually represents the user's vibe prompt; falls back to ✨. */
export async function pickEmojiForVibePromptWithAi(
  prompt: string,
  aiModelPreference: AiModelPreference,
): Promise<string> {
  const trimmed = prompt.trim();
  if (!trimmed) return FALLBACK_VIBE_EMOJI;
  try {
    const raw = await aiChat(trimmed, PICK_EMOJI_SYSTEM, aiModelPreference, { temperature: 0.3 });
    const cleaned = raw.replace(/[\s"'`]+/g, "").trim();
    if (!cleaned) return FALLBACK_VIBE_EMOJI;
    // Try the whole cleaned string, then progressively shorter prefixes (handles ZWJ sequences).
    const candidates = [cleaned, [...cleaned].slice(0, 3).join(""), [...cleaned].slice(0, 2).join(""), [...cleaned][0] ?? ""];
    for (const candidate of candidates) {
      if (candidate && SINGLE_EMOJI_REGEX.test(candidate)) {
        return candidate;
      }
    }
    return FALLBACK_VIBE_EMOJI;
  } catch {
    return FALLBACK_VIBE_EMOJI;
  }
}
