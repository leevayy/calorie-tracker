import type { AiModelPreference } from "../contracts/common.ts";
import { env } from "../env.ts";
import { generateMealSlugWithAi } from "./ai.ts";
import { normalizeSlugFallback, sanitizeMealSlug } from "./slugShape.ts";

export { normalizeSlugFallback, sanitizeMealSlug } from "./slugShape.ts";

export type ResolveMealSlugContext = {
  aiModelPreference: AiModelPreference;
  /** When true, never calls AI (tests / offline). */
  skipParse?: boolean;
};

/**
 * AI-first slug resolver used when the client did not already supply a slug (e.g. legacy clients,
 * the backfill script, or any flow that bypasses the parse-food step). All semantic safeguards
 * (token whitelist, quantity stripping, language normalization, etc.) live in the prompt — see
 * `generateMealSlugWithAi`. The local code only enforces the structural slug shape and provides a
 * non-semantic fallback when the AI path is unavailable. Occasional model mistakes are acceptable.
 */
export async function resolveMealSlugFromLoggedName(
  name: string,
  ctx: ResolveMealSlugContext,
): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) return "unknown";

  if (ctx.skipParse || !env.YANDEX_AI_STUDIO_API_KEY) {
    return normalizeSlugFallback(trimmed);
  }

  try {
    const raw = await generateMealSlugWithAi(trimmed, ctx.aiModelPreference);
    const sanitized = sanitizeMealSlug(raw);
    if (sanitized) return sanitized;
  } catch {
    /* fall through to local fallback */
  }

  return normalizeSlugFallback(trimmed);
}
