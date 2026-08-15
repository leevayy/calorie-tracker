import { AiModelPreferenceSchema, type AiModelPreference } from "@contracts/common";

export function coerceAiModelPreference(code: string | undefined): AiModelPreference {
  const parsed = AiModelPreferenceSchema.safeParse(code);
  return parsed.success ? parsed.data : "qwen3";
}

export const AI_MODEL_PREFERENCE_OPTIONS: { value: AiModelPreference; labelKey: string }[] = [
  { value: "alicegpt", labelKey: "aiModels.alicegpt" },
  { value: "deepseek", labelKey: "aiModels.deepseek" },
  { value: "qwen36", labelKey: "aiModels.qwen36" },
  { value: "aliceflash", labelKey: "aiModels.aliceflash" },
  { value: "qwen3", labelKey: "aiModels.qwen3" },
  { value: "gptoss120", labelKey: "aiModels.gptoss120" },
  { value: "gptoss", labelKey: "aiModels.gptoss" },
];
