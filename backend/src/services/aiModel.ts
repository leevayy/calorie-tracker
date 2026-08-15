import type { AiModelPreference } from "../contracts/common.ts";
import { env } from "../env.ts";

export function configuredAiModelId(preference: AiModelPreference): string {
  switch (preference) {
    case "alicegpt":
      return env.YANDEX_AI_STUDIO_MODEL_ALICE_GPT;
    case "aliceflash":
      return env.YANDEX_AI_STUDIO_MODEL_ALICE_FLASH;
    case "qwen36":
      return env.YANDEX_AI_STUDIO_MODEL_QWEN36;
    case "qwen3":
      return env.YANDEX_AI_STUDIO_MODEL_QWEN3;
    case "gptoss120":
      return env.YANDEX_AI_STUDIO_MODEL_GPT_OSS_120B;
    case "gptoss":
      return env.YANDEX_AI_STUDIO_MODEL_GPT_OSS;
    default:
      return env.YANDEX_AI_STUDIO_MODEL;
  }
}

export function configuredAiModelUri(preference: AiModelPreference): string {
  const modelId = configuredAiModelId(preference);
  if (modelId.startsWith("gpt://") || !env.YANDEX_FOLDER_ID) return modelId;
  return `gpt://${env.YANDEX_FOLDER_ID}/${modelId}`;
}
