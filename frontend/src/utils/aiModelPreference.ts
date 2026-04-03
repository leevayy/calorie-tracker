import { AiModelPreferenceSchema, type AiModelPreference } from "@contracts/common";

export function coerceAiModelPreference(code: string | undefined): AiModelPreference {
  const parsed = AiModelPreferenceSchema.safeParse(code);
  return parsed.success ? parsed.data : "deepseek";
}

export const AI_MODEL_PREFERENCE_OPTIONS: { value: AiModelPreference; labelKey: string }[] = [
  { value: "deepseek", labelKey: "aiModels.deepseek" },
  { value: "qwen3", labelKey: "aiModels.qwen3" },
];
