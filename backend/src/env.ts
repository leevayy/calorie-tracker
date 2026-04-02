import { z } from "zod";

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
  DAILY_TIP_K_ANONYMITY_MIN: z.coerce.number().int().positive().default(5),
  PARSE_FOOD_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  PARSE_FOOD_CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(500),
  YANDEX_AI_STUDIO_API_KEY: z.string().optional(),
  YANDEX_FOLDER_ID: z.string().optional(),
  YANDEX_AI_STUDIO_URL: z
    .string()
    .url()
    .default("https://llm.api.cloud.yandex.net/v1/chat/completions"),
  YANDEX_AI_STUDIO_MODEL: z.string().default("deepseek-v3-2/latest"),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
