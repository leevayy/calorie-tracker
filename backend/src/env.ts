import { z } from "zod";
import { AiModelPreferenceSchema } from "./contracts/common.ts";

const EnvBooleanSchema = z.preprocess((value) => {
  if (value === undefined) return false;
  if (value === true || value === "true" || value === "1" || value === 1) return true;
  if (value === false || value === "false" || value === "0" || value === 0) return false;
  return value;
}, z.boolean());

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:5173,https://semcaltrack-s3.website.yandexcloud.net"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  RATE_LIMIT_MAX_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(900),
  PARSE_FOOD_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  PARSE_FOOD_CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(500),
  AI_MODEL_PREFERENCE: AiModelPreferenceSchema.default("qwen3"),
  E2E_TEST_MODE: EnvBooleanSchema,
  E2E_LIVE_AI: EnvBooleanSchema,
  E2E_CONTROL_SECRET: z.string().optional(),
  YANDEX_AI_STUDIO_API_KEY: z.string().optional(),
  YANDEX_FOLDER_ID: z.string().optional(),
  YANDEX_AI_STUDIO_URL: z
    .string()
    .url()
    .default("https://ai.api.cloud.yandex.net/v1/chat/completions"),
  YANDEX_AI_STUDIO_MODEL: z.string().default("deepseek-v4-flash"),
  YANDEX_AI_STUDIO_MODEL_QWEN36: z.string().default("qwen3.6-35b-a3b"),
  YANDEX_AI_STUDIO_MODEL_QWEN3: z.string().default("qwen3-235b-a22b-fp8"),
  /**
   * Override for aiModelPreference `gptoss`. Empty/unset → default slug (confirm in Model Gallery).
   */
  YANDEX_AI_STUDIO_MODEL_GPT_OSS: z.preprocess(
    (val) => {
      const s = val == null ? "" : String(val).trim();
      return s.length > 0 ? s : "gpt-oss-20b";
    },
    z.string().min(1),
  ),
  /**
   * Override for aiModelPreference `gptoss120`. Empty/unset → current 120B model slug.
   */
  YANDEX_AI_STUDIO_MODEL_GPT_OSS_120B: z.preprocess(
    (val) => {
      const s = val == null ? "" : String(val).trim();
      return s.length > 0 ? s : "gpt-oss-120b";
    },
    z.string().min(1),
  ),
  /**
   * Override for aiModelPreference `alicegpt`. Empty/unset → flagship Alice AI LLM slug.
   */
  YANDEX_AI_STUDIO_MODEL_ALICE_GPT: z.preprocess(
    (val) => {
      const s = val == null ? "" : String(val).trim();
      return s.length > 0 ? s : "aliceai-llm";
    },
    z.string().min(1),
  ),
  /**
   * Override for aiModelPreference `aliceflash`. Empty/unset → lightweight Alice AI LLM slug.
   */
  YANDEX_AI_STUDIO_MODEL_ALICE_FLASH: z.preprocess(
    (val) => {
      const s = val == null ? "" : String(val).trim();
      return s.length > 0 ? s : "aliceai-llm-flash";
    },
    z.string().min(1),
  ),
}).superRefine((value, context) => {
  if (value.E2E_LIVE_AI && !value.E2E_TEST_MODE) {
    context.addIssue({
      code: "custom",
      path: ["E2E_LIVE_AI"],
      message: "E2E_LIVE_AI requires E2E_TEST_MODE",
    });
  }
  if (!value.E2E_TEST_MODE) return;
  if (value.NODE_ENV !== "test") {
    context.addIssue({
      code: "custom",
      path: ["E2E_TEST_MODE"],
      message: "E2E_TEST_MODE is only permitted when NODE_ENV=test",
    });
  }
  if (!value.E2E_CONTROL_SECRET || value.E2E_CONTROL_SECRET.length < 16) {
    context.addIssue({
      code: "custom",
      path: ["E2E_CONTROL_SECRET"],
      message: "E2E_CONTROL_SECRET must contain at least 16 characters",
    });
  }
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(input: Record<string, unknown>): Env {
  return EnvSchema.parse(input);
}

export const env: Env = parseEnv(process.env);
