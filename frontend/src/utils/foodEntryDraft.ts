import type { MealType } from "@contracts/common";
import type { FoodEntryResponse, UpdateFoodEntryBody } from "@contracts/food-log";
import { UpdateFoodEntryBodySchema } from "@contracts/food-log";

const NUMERIC_FIELDS = ["calories", "protein", "carbs", "fats", "fiber"] as const;
type NumericField = (typeof NUMERIC_FIELDS)[number];

export type FoodEntryDraft = {
  name: string;
  portion: string;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
  fiber: string;
  day: string;
  mealType: MealType;
};

export type FoodEntryDraftField = keyof FoodEntryDraft;
export type FoodEntryDraftErrors = Partial<Record<FoodEntryDraftField, string>>;

export type ParsedFoodEntryDraft =
  | { success: true; data: UpdateFoodEntryBody; errors: FoodEntryDraftErrors }
  | { success: false; errors: FoodEntryDraftErrors };

export function foodEntryDraftFromEntry(entry: FoodEntryResponse): FoodEntryDraft {
  return {
    name: entry.name,
    portion: entry.portion ?? "",
    calories: String(entry.calories),
    protein: String(entry.protein),
    carbs: String(entry.carbs),
    fats: String(entry.fats),
    fiber: String(entry.fiber),
    day: entry.day,
    mealType: entry.mealType,
  };
}

export function parseFoodEntryDraft(draft: FoodEntryDraft): ParsedFoodEntryDraft {
  const errors: FoodEntryDraftErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = "entryEditor.validation.required";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.day)) {
    errors.day = "entryEditor.validation.date";
  }

  const numbers = {} as Record<NumericField, number>;
  for (const field of NUMERIC_FIELDS) {
    const raw = draft[field].trim();
    const value = raw === "" ? Number.NaN : Number(raw);
    numbers[field] = value;
    if (!Number.isFinite(value)) {
      errors[field] = "entryEditor.validation.number";
    } else if (value < 0) {
      errors[field] = "entryEditor.validation.nonnegative";
    }
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };

  const parsed = UpdateFoodEntryBodySchema.safeParse({
    name,
    portion: draft.portion.trim() || undefined,
    calories: numbers.calories,
    protein: numbers.protein,
    carbs: numbers.carbs,
    fats: numbers.fats,
    fiber: numbers.fiber,
    day: draft.day,
    mealType: draft.mealType,
  });
  if (parsed.success) return { success: true, data: parsed.data, errors: {} };

  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || !(field in draft)) continue;
    errors[field as FoodEntryDraftField] =
      field === "day"
        ? "entryEditor.validation.date"
        : field === "name"
          ? "entryEditor.validation.required"
          : "entryEditor.validation.number";
  }
  return { success: false, errors };
}
