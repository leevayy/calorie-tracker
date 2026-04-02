import { z } from "zod";
import type { PreferredLanguage } from "../contracts/common.ts";
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

Schema:
{
  "foods": [
    {
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
        description: z.string().min(1),
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

const PARSE_FOOD_CACHE_VERSION = "v1";
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

async function aiChat(prompt: string, system: string): Promise<string> {
  const apiKey = env.YANDEX_AI_STUDIO_API_KEY;
  if (!apiKey) {
    throw new Error("Yandex AI Studio API key is missing");
  }

  const authorizationHeader = apiKey.startsWith("AQVN")
    ? `Api-Key ${apiKey}`
    : `Bearer ${apiKey}`;
  const model = resolveModelUri();
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
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI upstream error: ${response.status} ${body}`);
  }

  const json = ChatCompletionSchema.parse(await response.json());
  return json.choices[0]?.message.content ?? "";
}

function resolveModelUri(): string {
  if (env.YANDEX_AI_STUDIO_MODEL.startsWith("gpt://")) {
    return env.YANDEX_AI_STUDIO_MODEL;
  }
  if (env.YANDEX_FOLDER_ID) {
    return `gpt://${env.YANDEX_FOLDER_ID}/${env.YANDEX_AI_STUDIO_MODEL}`;
  }
  return env.YANDEX_AI_STUDIO_MODEL;
}

function normalizeParseFoodText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildParseFoodCacheKey(text: string, preferredLanguage: PreferredLanguage): string {
  return `${PARSE_FOOD_CACHE_VERSION}:${resolveModelUri()}:${preferredLanguage}:${normalizeParseFoodText(text)}`;
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
};

function buildNutritionParserSystem(preferredLanguage: PreferredLanguage): string {
  const langName = OUTPUT_LANGUAGE_NAMES[preferredLanguage];
  return `${NutritionParserPrompt}

9. OUTPUT LANGUAGE
- Food descriptions (the "description" field) and portion text must be in ${langName} (BCP-style tag: ${preferredLanguage}).`;
}

async function generateParseFoodSuggestions(
  text: string,
  preferredLanguage: PreferredLanguage,
): Promise<ParsedFoodSuggestion[]> {
  const raw = await aiChat(text, buildNutritionParserSystem(preferredLanguage));
  const parsed = NutritionParserResponseSchema.parse(JSON.parse(extractFirstJsonObject(raw)));

  return parsed.foods.map((food) =>
    ParsedFoodSuggestionSchema.parse({
      name: food.description,
      calories: getNutrientAmount(food.nutrients, "calories"),
      protein: getNutrientAmount(food.nutrients, "protein"),
      carbs: getNutrientAmount(food.nutrients, "carbohydrates"),
      fats: getNutrientAmount(food.nutrients, "fat"),
      portion: food.estimated_portion ?? "1 serving",
    }),
  );
}

export async function parseFoodTextWithAi(
  text: string,
  preferredLanguage: PreferredLanguage,
): Promise<ParsedFoodSuggestion[]> {
  const cacheKey = buildParseFoodCacheKey(text, preferredLanguage);

  const cached = getCachedParseFoodSuggestions(cacheKey);
  if (cached) {
    return cached;
  }

  const inFlight = parseFoodInFlight.get(cacheKey);
  if (inFlight) {
    return cloneSuggestions(await inFlight);
  }

  const requestPromise = generateParseFoodSuggestions(text, preferredLanguage);
  parseFoodInFlight.set(cacheKey, requestPromise);

  try {
    const suggestions = await requestPromise;
    setCachedParseFoodSuggestions(cacheKey, suggestions);
    return cloneSuggestions(suggestions);
  } finally {
    parseFoodInFlight.delete(cacheKey);
  }
}

type TipContext = {
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

export async function generateTipMessageWithAi(context: TipContext): Promise<string> {
  const langName = OUTPUT_LANGUAGE_NAMES[context.preferredLanguage];
  const dayFrac = fractionOfLocalDayElapsed(context.localTimeHm);
  const system = [
    `You are a concise calorie tracking coach.`,
    `Write the entire tip in ${langName} (language tag: ${context.preferredLanguage}).`,
    `The user's logged calendar day is ${context.date}. Their local clock is ${context.localTimeHm} in IANA zone "${context.clientTimeZone}".`,
    `About ${Math.round(dayFrac * 100)}% of their local day has passed (from local midnight to local time).`,
    `Use that timing: early in the local day, do not shame low intake; later in the day, if they are far under goal, you may give a direct, good-humored nudge to eat enough — stay supportive, not cruel.`,
    `Return one short tip sentence, under 220 characters.`,
    `Reference progress vs calorie goal and, if present in the JSON, community average.`,
    `Do not include markdown or bullet points.`,
  ].join("\n");

  return aiChat(JSON.stringify(context), system);
}

const FALLBACK_TIP: Record<
  PreferredLanguage,
  (ctx: TipContext, pct: number, delta: number, deltaTextKey: "below" | "above", macroLow: boolean) => string
> = {
  en: (ctx, pct, delta, key, macroLow) => {
    const deltaText =
      key === "below" ? `${delta} kcal below your goal` : `${delta} kcal above your goal`;
    const macroTip = macroLow
      ? "Consider adding protein in your next meal."
      : "Your protein intake looks solid today.";
    const communityText =
      ctx.communityAvgCalories == null
        ? ""
        : ` People in your cohort average ${Math.round(ctx.communityAvgCalories)} kcal today.`;
    return `${pct}% of goal, ${deltaText}. ${macroTip}${communityText}`.trim();
  },
  ru: (ctx, pct, delta, key, macroLow) => {
    const deltaText =
      key === "below" ? `${delta} ккал ниже цели` : `${delta} ккал выше цели`;
    const macroTip = macroLow
      ? "Добавьте белка в следующий приём пищи."
      : "С белком сегодня всё неплохо.";
    const communityText =
      ctx.communityAvgCalories == null
        ? ""
        : ` У похожих по цели в среднем ${Math.round(ctx.communityAvgCalories)} ккал сегодня.`;
    return `${pct}% от цели, ${deltaText}. ${macroTip}${communityText}`.trim();
  },
  pl: (ctx, pct, delta, key, macroLow) => {
    const deltaText =
      key === "below" ? `${delta} kcal poniżej celu` : `${delta} kcal powyżej celu`;
    const macroTip = macroLow
      ? "Rozważ dodanie białka w następnym posiłku."
      : "Dziś wygląda to nieźle z białkiem.";
    const communityText =
      ctx.communityAvgCalories == null
        ? ""
        : ` W Twojej grupie średnio ${Math.round(ctx.communityAvgCalories)} kcal dziś.`;
    return `${pct}% celu, ${deltaText}. ${macroTip}${communityText}`.trim();
  },
  tt: (ctx, pct, delta, key, macroLow) => {
    const deltaText =
      key === "below" ? `${delta} ккал максаттан түбән` : `${delta} ккал максаттан югары`;
    const macroTip = macroLow
      ? "Киләсе ашауга аксым өстәп карагыз."
      : "Бүген аксым белән әйбәт.";
    const communityText =
      ctx.communityAvgCalories == null
        ? ""
        : ` Сезнең төркемдә бүген уртача ${Math.round(ctx.communityAvgCalories)} ккал.`;
    return `${pct}% максат, ${deltaText}. ${macroTip}${communityText}`.trim();
  },
};

export function generateFallbackTipMessage(context: TipContext): string {
  const pct = Math.round((context.consumedCalories / context.calorieGoal) * 100);
  const rawDelta = context.calorieGoal - context.consumedCalories;
  const delta = Math.round(Math.abs(rawDelta));
  const deltaKey = rawDelta >= 0 ? ("below" as const) : ("above" as const);
  const macroLow = context.proteinG < 60;
  const dayFrac = fractionOfLocalDayElapsed(context.localTimeHm);
  const base = FALLBACK_TIP[context.preferredLanguage](context, pct, delta, deltaKey, macroLow);
  if (dayFrac >= 0.55 && rawDelta > context.calorieGoal * 0.35) {
    const nudges: Record<PreferredLanguage, string> = {
      en: " It's getting late locally — plan a solid meal so you don't finish the day short.",
      ru: " День уже не в начале — спланируйте нормальный приём пищи, чтобы не недоесть.",
      pl: " Jest już późno lokalnie — zaplanuj solidny posiłek, żeby nie kończyć dnia z deficytem.",
      tt: " Көн инде соңына якын — көн ахырына кимчелек калдырмаска ашарыгызны планлаштырыгыз.",
    };
    return `${base}${nudges[context.preferredLanguage]}`;
  }
  return base;
}
