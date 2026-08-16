import {
  expect,
  test as base,
  type Page,
} from "@playwright/test";

export type E2ESeedProfile = {
  dailyCalorieGoal?: number;
  weightKg?: number;
  heightCm?: number;
  preferredLanguage?: "en" | "ru" | "pl" | "tt" | "kk";
  nutritionGoal?: "maintain" | "muscle_gain" | "fat_loss" | "recomposition";
};

export type E2ESeedEntry = {
  day: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  portion?: string;
  mealSlug?: string;
};

export type E2ETestUser = {
  email: string;
  password: string;
  profile?: E2ESeedProfile;
  entries?: E2ESeedEntry[];
};

export type E2ESetupSession = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
};

export type E2EAiMode = {
  parseFood?:
    | "success"
    | "multi-food"
    | "explicit-nutrition"
    | "delay"
    | "ambiguous"
    | "failure";
  correction?: "success" | "delay" | "ambiguous" | "failure";
  delayMs?: number;
};

type E2ESeedResult = {
  users: Array<{ id: string; email: string; entryIds: string[] }>;
};

export type E2EControlClient = {
  reset(users?: E2ETestUser[]): Promise<E2ESeedResult>;
  setAiMode(mode: E2EAiMode): Promise<E2EAiMode>;
  failNextBatchSave(): Promise<{ nextBatchSave: boolean }>;
  delayNextHistoricalSuggestions(
    delayMs: number,
  ): Promise<{ nextHistoricalSuggestionsMs: number }>;
};

/** Matches the app's UTC-configured browser log day, including its 04:00 boundary. */
export function behavioralIsoDay(offset = 0): string {
  const date = new Date();
  if (date.getUTCHours() < 4) date.setUTCDate(date.getUTCDate() - 1);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** UTC calendar day used by the History screen, whose range is calendar-based. */
export function calendarIsoDay(offset = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function requiredEnvironment(name: "E2E_BASE_URL" | "E2E_CONTROL_SECRET"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Playwright system tests`);
  return value;
}

function controlUrl(pathname: string): string {
  const origin = process.env.E2E_API_URL?.trim() || requiredEnvironment("E2E_BASE_URL");
  return new URL(pathname, `${origin.replace(/\/$/, "")}/`).toString();
}

async function postControl<T>(pathname: string, body: unknown): Promise<T> {
  const response = await fetch(controlUrl(pathname), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-e2e-control-secret": requiredEnvironment("E2E_CONTROL_SECRET"),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`E2E control ${pathname} failed with HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function createControlClient(): E2EControlClient {
  return {
    reset(users = []) {
      return postControl<E2ESeedResult>("/api/v1/__e2e/reset", { users });
    },
    setAiMode(mode) {
      return postControl<E2EAiMode>("/api/v1/__e2e/ai-mode", mode);
    },
    failNextBatchSave() {
      return postControl<{ nextBatchSave: boolean }>("/api/v1/__e2e/failures", {
        nextBatchSave: true,
      });
    },
    delayNextHistoricalSuggestions(delayMs) {
      return postControl<{ nextHistoricalSuggestionsMs: number }>("/api/v1/__e2e/delays", {
        nextHistoricalSuggestionsMs: delayMs,
      });
    },
  };
}

export function isolatedTestUser(overrides: Partial<E2ETestUser> = {}): E2ETestUser {
  return {
    email: process.env.E2E_TEST_EMAIL?.trim() || "playwright@example.invalid",
    password: process.env.E2E_TEST_PASSWORD || "playwright-local-only-password",
    profile: {
      dailyCalorieGoal: 2_000,
      weightKg: 70,
      heightCm: 175,
      preferredLanguage: "en",
      nutritionGoal: "maintain",
    },
    ...overrides,
  };
}

export async function loginThroughVisibleUi(page: Page, user: E2ETestUser): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator('button[aria-current="page"]')).toHaveCount(1);
}

function isMatchingPublicSessionHandle(
  candidate: unknown,
  kind: "access" | "refresh",
  user: E2ESetupSession["user"],
): candidate is string {
  if (typeof candidate !== "string") return false;
  const match = new RegExp(
    `^e2e-public-session-v1:${kind}:` +
      "([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):" +
      "([A-Za-z0-9_-]+)$",
    "i",
  ).exec(candidate);
  if (!match || match[1] !== user.id) return false;
  const encodedEmail = match[2];
  if (!encodedEmail) return false;
  try {
    const decodedEmail = Buffer.from(encodedEmail, "base64url").toString("utf8");
    return (
      decodedEmail === user.email &&
      Buffer.from(decodedEmail, "utf8").toString("base64url") === encodedEmail
    );
  } catch {
    return false;
  }
}

/** Authenticate synthetic non-auth journeys without recording password entry or secret tokens. */
export async function loginThroughSetup(
  page: Page,
  user: E2ETestUser,
): Promise<E2ESetupSession> {
  const response = await fetch(controlUrl("/api/v1/auth/login"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  if (!response.ok) throw new Error(`E2E setup login failed with HTTP ${response.status}`);
  const auth = (await response.json()) as E2ESetupSession;
  if (
    !auth.user ||
    auth.user.email !== user.email.toLocaleLowerCase() ||
    !isMatchingPublicSessionHandle(auth.accessToken, "access", auth.user) ||
    !isMatchingPublicSessionHandle(auth.refreshToken, "refresh", auth.user)
  ) {
    throw new Error("E2E setup refused to pass secret auth tokens into browser artifacts");
  }
  const storedSession = JSON.stringify(auth);
  await page.goto("/");
  await page.evaluate((session) => {
    localStorage.setItem("calorie-tracker-auth", session);
  }, storedSession);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app$/);
  // The profile can switch i18n to a non-English language while this assertion
  // is waiting. Identify the selected tab by state rather than translated copy.
  await expect(page.locator('button[aria-current="page"]')).toHaveCount(1);
  return auth;
}

export async function openSettingsThroughVisibleUi(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
}

type E2EFixtures = {
  e2eControls: E2EControlClient;
  isolatedUser: E2ETestUser;
  authenticatedPage: Page;
};

export const test = base.extend<E2EFixtures>({
  e2eControls: async ({}, use) => {
    await use(createControlClient());
  },
  isolatedUser: async ({ e2eControls }, use) => {
    const user = isolatedTestUser();
    await e2eControls.reset([user]);
    await use(user);
  },
  authenticatedPage: async ({ page, isolatedUser }, use) => {
    await loginThroughSetup(page, isolatedUser);
    await use(page);
  },
});

export { expect };
