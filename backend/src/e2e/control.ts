import { timingSafeEqual } from "node:crypto";
import type {
  AiModelPreference,
  MealType,
  NutritionGoal,
  PreferredLanguage,
} from "../contracts/common.ts";
import type { ParsedFoodSuggestion, ParseFoodRequest } from "../contracts/ai-food.ts";
import type { FoodEntryCorrectionClassifier } from "../services/foodEntryCorrection.ts";
import type { FoodLogRepository } from "../services/foodLogRepository.ts";

export type E2ESeedEntry = {
  day: string;
  mealType: MealType;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  portion?: string;
  mealSlug?: string;
};

export type E2ESeedUser = {
  email: string;
  password: string;
  profile?: {
    dailyCalorieGoal?: number;
    weightKg?: number;
    heightCm?: number;
    preferredLanguage?: PreferredLanguage;
    nutritionGoal?: NutritionGoal;
  };
  entries?: E2ESeedEntry[];
};

export type E2ESeedRequest = {
  users: E2ESeedUser[];
};

export type E2ESeedResult = {
  users: Array<{
    id: string;
    email: string;
    entryIds: string[];
  }>;
};

export interface E2EControlPersistence {
  resetAndSeed(input: E2ESeedRequest): Promise<E2ESeedResult>;
}

export type E2EParseFoodMode =
  | "success"
  | "multi-food"
  | "explicit-nutrition"
  | "delay"
  | "ambiguous"
  | "failure";
export type E2ECorrectionMode = "success" | "delay" | "ambiguous" | "failure";

export type E2EAiModeState = {
  parseFood: E2EParseFoodMode;
  correction: E2ECorrectionMode;
  delayMs: number;
};

type ParseFoodTimingContext = Pick<
  ParseFoodRequest,
  "localDate" | "localTimeHm" | "clientTimeZone" | "defaultLogDay" | "defaultMealType"
>;

export type ParseFoodProvider = (
  text: string,
  preferredLanguage: PreferredLanguage,
  nutritionGoal: NutritionGoal,
  aiModelPreference: AiModelPreference,
  timing: ParseFoodTimingContext,
) => Promise<ParsedFoodSuggestion[]>;

export type E2EControlRuntime = {
  isAuthorized(candidate: string | undefined): boolean;
  resetAndSeed(input: E2ESeedRequest): Promise<E2ESeedResult>;
  configureAi(changes: Partial<E2EAiModeState>): E2EAiModeState;
  configureNextBatchSaveFailure(enabled: boolean): { nextBatchSave: boolean };
  configureNextHistoricalSuggestionDelay(
    delayMs: number,
  ): { nextHistoricalSuggestionsMs: number };
  parseFood: ParseFoodProvider;
  classifyCorrection: FoodEntryCorrectionClassifier;
  wrapFoodLogRepository(repository: FoodLogRepository): FoodLogRepository;
};

type CreateE2EControlRuntimeOptions = {
  enabled: boolean;
  nodeEnv: string;
  secret?: string;
  persistence: E2EControlPersistence;
  resetApplicationState?: () => void;
};

const issuedRuntimes = new WeakSet<object>();

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseFoodSuccess(timing: ParseFoodTimingContext): ParsedFoodSuggestion[] {
  return [
    {
      name: "E2E oatmeal",
      calories: 320,
      protein: 12,
      carbs: 52,
      fats: 8,
      fiber: 7,
      portion: "1 bowl",
      day: timing.defaultLogDay,
      mealType: timing.defaultMealType,
      description: "Deterministic E2E suggestion",
      confidence: 1,
      mealSlug: "oatmeal",
    },
  ];
}

function parseFoodMulti(timing: ParseFoodTimingContext): ParsedFoodSuggestion[] {
  return [
    ...parseFoodSuccess(timing),
    {
      name: "E2E banana",
      calories: 105,
      protein: 1.3,
      carbs: 27,
      fats: 0.4,
      fiber: 3.1,
      portion: "1 medium",
      day: timing.defaultLogDay,
      mealType: timing.defaultMealType,
      description: "Second deterministic E2E suggestion",
      confidence: 1,
      mealSlug: "banana",
    },
  ];
}

const explicitNutritionPattern = new RegExp(
  "^(?<name>[^,]+),\\s*portion\\s+(?<portion>[^,]+),\\s*" +
    "(?<calories>\\d+(?:\\.\\d+)?)\\s+calories,\\s*" +
    "(?<protein>\\d+(?:\\.\\d+)?)\\s*g\\s+protein,\\s*" +
    "(?<carbs>\\d+(?:\\.\\d+)?)\\s*g\\s+carbs,\\s*" +
    "(?<fats>\\d+(?:\\.\\d+)?)\\s*g\\s+fat,\\s*" +
    "(?<fiber>\\d+(?:\\.\\d+)?)\\s*g\\s+fiber$",
  "i",
);

function parseExplicitNutrition(
  text: string,
  timing: ParseFoodTimingContext,
): ParsedFoodSuggestion[] {
  const groups = explicitNutritionPattern.exec(text.trim())?.groups;
  if (!groups) {
    throw new Error("Deterministic E2E explicit-nutrition input did not match its fixture format");
  }

  const inferred = parseFoodSuccess(timing)[0];
  if (!inferred) throw new Error("Deterministic E2E inference fixture is missing");
  return [
    {
      // Begin with deliberately conflicting inference, then let the user's
      // submitted literals win just as the production provider contract requires.
      ...inferred,
      name: groups.name?.trim() ?? inferred.name,
      portion: groups.portion?.trim() ?? inferred.portion,
      calories: Number(groups.calories),
      protein: Number(groups.protein),
      carbs: Number(groups.carbs),
      fats: Number(groups.fats),
      fiber: Number(groups.fiber),
      description: "Deterministic explicit nutrition over conflicting inference",
      mealSlug: "explicit-nutrition",
    },
  ];
}

export function assertE2EControlRuntime(runtime: E2EControlRuntime): void {
  if (!issuedRuntimes.has(runtime)) {
    throw new Error("E2E controls require an explicitly activated E2E test runtime");
  }
}

export function createE2EControlRuntime(
  options: CreateE2EControlRuntimeOptions,
): E2EControlRuntime {
  if (!options.enabled || options.nodeEnv !== "test") {
    throw new Error("E2E controls require explicit E2E test mode with NODE_ENV=test");
  }
  if (!options.secret || options.secret.length < 16) {
    throw new Error("E2E_CONTROL_SECRET must contain at least 16 characters");
  }

  const expectedSecret = Buffer.from(options.secret);
  let aiState: E2EAiModeState = {
    parseFood: "success",
    correction: "success",
    delayMs: 0,
  };
  let nextBatchSaveFailure = false;
  let nextHistoricalSuggestionDelayMs = 0;

  const resetMemory = () => {
    aiState = {
      parseFood: "success",
      correction: "success",
      delayMs: 0,
    };
    nextBatchSaveFailure = false;
    nextHistoricalSuggestionDelayMs = 0;
  };

  const runtime: E2EControlRuntime = {
    isAuthorized(candidate) {
      if (!candidate) return false;
      const actualSecret = Buffer.from(candidate);
      return (
        actualSecret.length === expectedSecret.length &&
        timingSafeEqual(actualSecret, expectedSecret)
      );
    },

    async resetAndSeed(input) {
      resetMemory();
      options.resetApplicationState?.();
      return options.persistence.resetAndSeed(input);
    },

    configureAi(changes) {
      aiState = { ...aiState, ...changes };
      return { ...aiState };
    },

    configureNextBatchSaveFailure(enabled) {
      nextBatchSaveFailure = enabled;
      return { nextBatchSave: nextBatchSaveFailure };
    },

    configureNextHistoricalSuggestionDelay(delayMs) {
      nextHistoricalSuggestionDelayMs = delayMs;
      return { nextHistoricalSuggestionsMs: nextHistoricalSuggestionDelayMs };
    },

    async parseFood(text, _preferredLanguage, _nutritionGoal, _model, timing) {
      const mode = aiState.parseFood;
      if (mode === "failure") throw new Error("Deterministic E2E parse failure");
      if (mode === "ambiguous") return [];
      if (mode === "delay") await delay(aiState.delayMs);
      if (mode === "explicit-nutrition") return parseExplicitNutrition(text, timing);
      return mode === "multi-food" ? parseFoodMulti(timing) : parseFoodSuccess(timing);
    },

    async classifyCorrection() {
      const mode = aiState.correction;
      if (mode === "failure") throw new Error("Deterministic E2E correction failure");
      if (mode === "ambiguous") return { kind: "reject", reason: "ambiguous" };
      if (mode === "delay") await delay(aiState.delayMs);
      return { kind: "scale", factor: 2, portion: "2 servings" };
    },

    wrapFoodLogRepository(repository) {
      return {
        ...repository,
        async findHistoricalFoodSuggestions(userId, query, limit) {
          const delayMs = nextHistoricalSuggestionDelayMs;
          nextHistoricalSuggestionDelayMs = 0;
          if (delayMs > 0) await delay(delayMs);
          return repository.findHistoricalFoodSuggestions(userId, query, limit);
        },
        async createEntriesAtomic(entries) {
          if (nextBatchSaveFailure) {
            nextBatchSaveFailure = false;
            throw new Error("Deterministic E2E batch-save failure");
          }
          return repository.createEntriesAtomic(entries);
        },
      };
    },
  };

  issuedRuntimes.add(runtime);
  return runtime;
}
