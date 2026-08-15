import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, test, vi } from "vitest";
import { issuePublicE2ESession } from "./e2e/publicSession.ts";

const SECRET = "0123456789abcdef";
const USER_ID = "00000000-0000-4000-8000-000000000101";
const USER_EMAIL = "playwright@example.invalid";
const apps: FastifyInstance[] = [];

async function buildWithE2EMode(enabled: boolean, liveAi = false) {
  vi.resetModules();
  const realParseFood = vi.fn().mockResolvedValue([]);
  const realCorrection = vi.fn().mockResolvedValue({ kind: "scale", factor: 1.5 });
  vi.doMock("./env.ts", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./env.ts")>();
    return {
      ...actual,
      env: {
        ...actual.env,
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/calorie_tracker_e2e",
        E2E_TEST_MODE: enabled,
        E2E_LIVE_AI: liveAi,
        E2E_CONTROL_SECRET: enabled ? SECRET : undefined,
        RATE_LIMIT_MAX_REQUESTS_PER_MINUTE: 1,
      },
    };
  });
  vi.doMock("./db/client.ts", () => ({
    db: {
      query: {
        usersTable: {
          findFirst: vi.fn().mockResolvedValue({
            id: USER_ID,
            email: USER_EMAIL,
            nutritionGoal: "maintain",
            dailyCalorieGoal: 2_000,
          }),
        },
        foodEntriesTable: {
          findFirst: vi.fn().mockResolvedValue({
            id: "00000000-0000-4000-8000-000000000001",
            userId: USER_ID,
            day: "2026-08-15",
            mealType: "breakfast",
            name: "Oatmeal",
            calories: 300,
            protein: 10,
            carbs: 50,
            fats: 7,
            fiber: 6,
            portion: "1 bowl",
            mealSlug: "oatmeal",
            createdAt: new Date("2026-08-15T05:00:00.000Z"),
            deletedAt: null,
          }),
        },
      },
    },
    pool: { end: vi.fn() },
  }));
  vi.doMock("./services/ai.ts", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./services/ai.ts")>();
    return { ...actual, parseFoodTextWithAi: realParseFood };
  });
  vi.doMock("./services/foodEntryCorrectionAi.ts", () => ({
    classifyFoodEntryCorrectionWithAi: realCorrection,
  }));
  const { buildApp } = await import("./app.ts");
  const app = await buildApp();
  apps.push(app);
  return { app, realParseFood, realCorrection };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.doUnmock("./env.ts");
  vi.doUnmock("./db/client.ts");
  vi.doUnmock("./services/ai.ts");
  vi.doUnmock("./services/foodEntryCorrectionAi.ts");
  vi.resetModules();
});

describe("app E2E composition", () => {
  test("does not expose control routes when explicit E2E mode is disabled", async () => {
    const { app } = await buildWithE2EMode(false);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/__e2e/ai-mode",
      headers: { "x-e2e-control-secret": SECRET },
      payload: { parseFood: "success" },
    });
    expect(response.statusCode).toBe(404);
  });

  test("registers controls and disables normal AI rate limiting only in explicit E2E mode", async () => {
    const { app } = await buildWithE2EMode(true);
    const controlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/__e2e/ai-mode",
      headers: { "x-e2e-control-secret": SECRET },
      payload: { parseFood: "success" },
    });
    expect(controlResponse.statusCode).toBe(200);

    const statuses = [];
    for (let index = 0; index < 3; index += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ai/parse-food",
        payload: {},
      });
      statuses.push(response.statusCode);
    }
    expect(statuses).toEqual([400, 400, 400]);
  });

  test("accepts public non-secret sessions only in E2E mode and refreshes them in kind", async () => {
    const publicSession = issuePublicE2ESession({ id: USER_ID, email: USER_EMAIL });
    const request = {
      method: "POST" as const,
      url: "/api/v1/ai/parse-food",
      headers: { authorization: `Bearer ${publicSession.accessToken}` },
      payload: {
        text: "oats",
        preferredLanguage: "en",
        localDate: "2026-08-15",
        localTimeHm: "08:00",
        clientTimeZone: "Europe/Moscow",
        defaultLogDay: "2026-08-15",
        defaultMealType: "breakfast",
      },
    };

    const { app: productionShape } = await buildWithE2EMode(false);
    expect((await productionShape.inject(request)).statusCode).toBe(401);
    expect(
      (
        await productionShape.inject({
          method: "POST",
          url: "/api/v1/auth/refresh",
          payload: { refreshToken: publicSession.refreshToken },
        })
      ).statusCode,
    ).toBe(401);

    const { app: e2eApp } = await buildWithE2EMode(true);
    expect((await e2eApp.inject(request)).statusCode).toBe(200);
    const refresh = await e2eApp.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: publicSession.refreshToken },
    });
    expect(refresh.statusCode).toBe(200);
    expect(refresh.json()).toEqual(publicSession);
  });

  test("deterministic E2E mode never calls the real parse or correction providers", async () => {
    const { app, realParseFood, realCorrection } = await buildWithE2EMode(true);
    const token = app.jwt.sign({ sub: USER_ID });

    const parseResponse = await app.inject({
      method: "POST",
      url: "/api/v1/ai/parse-food",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        text: "oats",
        preferredLanguage: "en",
        localDate: "2026-08-15",
        localTimeHm: "08:00",
        clientTimeZone: "Europe/Moscow",
        defaultLogDay: "2026-08-15",
        defaultMealType: "breakfast",
      },
    });
    const correctionResponse = await app.inject({
      method: "POST",
      url: "/api/v1/ai/entries/00000000-0000-4000-8000-000000000001/correction",
      headers: { authorization: `Bearer ${token}` },
      payload: { instruction: "double it", preferredLanguage: "en" },
    });

    expect(parseResponse.statusCode).toBe(200);
    expect(parseResponse.json().suggestions).toHaveLength(1);
    expect(correctionResponse.statusCode).toBe(200);
    expect(realParseFood).not.toHaveBeenCalled();
    expect(realCorrection).not.toHaveBeenCalled();
  });

  test("live-AI E2E mode keeps controls but composes the real providers", async () => {
    const { app, realParseFood, realCorrection } = await buildWithE2EMode(true, true);
    const token = app.jwt.sign({ sub: USER_ID });

    const controlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/__e2e/ai-mode",
      headers: { "x-e2e-control-secret": SECRET },
      payload: { parseFood: "failure", correction: "failure" },
    });
    const parseResponse = await app.inject({
      method: "POST",
      url: "/api/v1/ai/parse-food",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        text: "oats",
        preferredLanguage: "en",
        localDate: "2026-08-15",
        localTimeHm: "08:00",
        clientTimeZone: "Europe/Moscow",
        defaultLogDay: "2026-08-15",
        defaultMealType: "breakfast",
      },
    });
    const correctionResponse = await app.inject({
      method: "POST",
      url: "/api/v1/ai/entries/00000000-0000-4000-8000-000000000001/correction",
      headers: { authorization: `Bearer ${token}` },
      payload: { instruction: "increase by half", preferredLanguage: "en" },
    });

    expect(controlResponse.statusCode).toBe(200);
    expect(parseResponse.statusCode).toBe(200);
    expect(correctionResponse.statusCode).toBe(200);
    expect(realParseFood).toHaveBeenCalledOnce();
    expect(realCorrection).toHaveBeenCalledOnce();
  });
});
