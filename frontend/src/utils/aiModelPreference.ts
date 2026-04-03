import { AiModelPreferenceSchema, type AiModelPreference } from "@contracts/common";

export function coerceAiModelPreference(code: string | undefined): AiModelPreference {
  const parsed = AiModelPreferenceSchema.safeParse(code);
  return parsed.success ? parsed.data : "qwen3";
}

export const AI_MODEL_PREFERENCE_OPTIONS: { value: AiModelPreference; labelKey: string }[] = [
  { value: "qwen3", labelKey: "aiModels.qwen3" },
  { value: "deepseek", labelKey: "aiModels.deepseek" },
  { value: "gptoss", labelKey: "aiModels.gptoss" },
  { value: "alicegpt", labelKey: "aiModels.alicegpt" },
];
