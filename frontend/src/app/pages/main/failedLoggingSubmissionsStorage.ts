import { ParseFoodRequestSchema } from "@contracts/ai-food";
import { CreateFoodEntryRequestSchema } from "@contracts/food-log";
import { z } from "zod";
import type { ParseFoodTiming } from "@/utils/date";

const STORAGE_KEY_PREFIX = "calorie-tracker:failed-food-submissions:v1:";
const MAX_PERSISTED_FAILURES = 20;

const ParseFoodTimingSchema = ParseFoodRequestSchema.pick({
  localDate: true,
  localTimeHm: true,
  clientTimeZone: true,
  defaultLogDay: true,
  defaultMealType: true,
});

const PersistedFailedLoggingSubmissionSchema = z.object({
  id: z.string().min(1).max(200),
  text: z.string().min(1).max(10_000),
  retryFrom: z.enum(["parse", "save"]),
  errorKey: z.string().min(1).max(200),
  foods: z.array(CreateFoodEntryRequestSchema).max(100),
  timing: ParseFoodTimingSchema,
});

const PersistedFailedLoggingSubmissionsSchema = z
  .array(PersistedFailedLoggingSubmissionSchema)
  .max(MAX_PERSISTED_FAILURES);

export type PersistedFailedLoggingSubmission = {
  id: string;
  text: string;
  retryFrom: "parse" | "save";
  errorKey: string;
  foods: Array<z.infer<typeof CreateFoodEntryRequestSchema>>;
  timing: ParseFoodTiming;
};

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(userId)}`;
}

export function loadFailedLoggingSubmissions(
  userId: string | undefined,
): PersistedFailedLoggingSubmission[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = window.sessionStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    const result = PersistedFailedLoggingSubmissionsSchema.safeParse(parsed);
    if (result.success) return result.data;
    window.sessionStorage.removeItem(storageKey(userId));
    return [];
  } catch {
    return [];
  }
}

export function saveFailedLoggingSubmissions(
  userId: string | undefined,
  submissions: PersistedFailedLoggingSubmission[],
): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    const retained = submissions.slice(0, MAX_PERSISTED_FAILURES);
    if (retained.length === 0) {
      window.sessionStorage.removeItem(storageKey(userId));
      return;
    }
    const result = PersistedFailedLoggingSubmissionsSchema.safeParse(retained);
    if (!result.success) return;
    window.sessionStorage.setItem(storageKey(userId), JSON.stringify(result.data));
  } catch {
    /* Session storage can be unavailable or full; logging must still work. */
  }
}
