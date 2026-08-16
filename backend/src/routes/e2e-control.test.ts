import jwt from "@fastify/jwt";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createE2EControlRuntime, type E2EControlPersistence } from "../e2e/control.ts";
import { sendUnauthorized } from "../lib/http.ts";
import type { FoodEntryRecord } from "../services/foodLogRepository.ts";
import { registerE2EControlRoutes } from "./e2e-control.ts";
import { registerFoodEntryCorrectionRoutes } from "./food-entry-correction.ts";

const SECRET = "0123456789abcdef";
const apps: FastifyInstance[] = [];

function buildRuntime(persistence: E2EControlPersistence) {
  return createE2EControlRuntime({
    enabled: true,
    nodeEnv: "test",
    secret: SECRET,
    persistence,
  });
}

async function buildTestApp(persistence: E2EControlPersistence) {
  const app = Fastify();
  apps.push(app);
  const runtime = buildRuntime(persistence);
  await registerE2EControlRoutes(app, runtime);
  return { app, runtime };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("E2E control routes", () => {
  test("rejects missing and incorrect control secrets without resetting data", async () => {
    const resetAndSeed = vi.fn();
    const { app } = await buildTestApp({ resetAndSeed });

    for (const headers of [{}, { "x-e2e-control-secret": "incorrect-secret-value" }]) {
      const response = await app.inject({
        method: "POST",
        url: "/__e2e/reset",
        headers,
        payload: { users: [] },
      });
      expect(response.statusCode).toBe(401);
    }
    expect(resetAndSeed).not.toHaveBeenCalled();
  });

  test("resets and seeds isolated users with historical entries", async () => {
    const resetAndSeed = vi.fn(async () => ({
      users: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          email: "first@example.test",
          entryIds: ["00000000-0000-4000-8000-000000000011"],
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          email: "second@example.test",
          entryIds: [],
        },
      ],
    }));
    const { app } = await buildTestApp({ resetAndSeed });
    const payload = {
      users: [
        {
          email: "first@example.test",
          password: "test-password-one",
          profile: { dailyCalorieGoal: 2100, preferredLanguage: "en" },
          entries: [
            {
              day: "2026-08-14",
              mealType: "breakfast",
              name: "Seed oats",
              calories: 300,
              protein: 10,
              carbs: 50,
              fats: 7,
              fiber: 6,
              portion: "1 bowl",
              mealSlug: "oatmeal",
            },
          ],
        },
        {
          email: "second@example.test",
          password: "test-password-two",
          entries: [],
        },
      ],
    };

    const response = await app.inject({
      method: "POST",
      url: "/__e2e/reset",
      headers: { "x-e2e-control-secret": SECRET },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(resetAndSeed).toHaveBeenCalledWith(payload);
    expect(response.json()).toEqual(await resetAndSeed.mock.results[0]?.value);
  });

  test("accepts a 1,001-entry performance fixture while keeping seed payloads bounded", async () => {
    const resetAndSeed = vi.fn(async () => ({ users: [] }));
    const { app } = await buildTestApp({ resetAndSeed });
    const entry = {
      day: "2026-08-14",
      mealType: "breakfast",
      calories: 300,
      protein: 10,
      carbs: 50,
      fats: 7,
      fiber: 6,
    } as const;
    const request = (entryCount: number) => app.inject({
      method: "POST",
      url: "/__e2e/reset",
      headers: { "x-e2e-control-secret": SECRET },
      payload: {
        users: [{
          email: "large-history@example.test",
          password: "test-password-large-history",
          entries: Array.from({ length: entryCount }, (_, index) => ({
            ...entry,
            name: `Historical entry ${index}`,
          })),
        }],
      },
    });

    expect((await request(1_001)).statusCode).toBe(200);
    expect((await request(2_001)).statusCode).toBe(400);
    expect(resetAndSeed).toHaveBeenCalledOnce();
  });

  test("accepts the deterministic explicit-nutrition provider mode", async () => {
    const { app } = await buildTestApp({ resetAndSeed: vi.fn() });

    const response = await app.inject({
      method: "POST",
      url: "/__e2e/ai-mode",
      headers: { "x-e2e-control-secret": SECRET },
      payload: { parseFood: "explicit-nutrition" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ parseFood: "explicit-nutrition" });
  });

  test("configures a bounded one-shot historical-suggestion delay", async () => {
    const { app } = await buildTestApp({ resetAndSeed: vi.fn() });

    const response = await app.inject({
      method: "POST",
      url: "/__e2e/delays",
      headers: { "x-e2e-control-secret": SECRET },
      payload: { nextHistoricalSuggestionsMs: 1_500 },
    });
    const excessive = await app.inject({
      method: "POST",
      url: "/__e2e/delays",
      headers: { "x-e2e-control-secret": SECRET },
      payload: { nextHistoricalSuggestionsMs: 10_001 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ nextHistoricalSuggestionsMs: 1_500 });
    expect(excessive.statusCode).toBe(400);
  });

  test("a controlled correction-provider failure cannot persist a preview", async () => {
    const app = Fastify();
    apps.push(app);
    const runtime = buildRuntime({ resetAndSeed: vi.fn() });
    const stored: FoodEntryRecord = {
      id: "00000000-0000-4000-8000-000000000001",
      userId: "user-1",
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
    };
    const before = { ...stored };
    const updateEntry = vi.fn();
    const repository = {
      findActiveEntry: vi.fn(async () => ({ ...stored })),
      updateEntry,
    };

    await app.register(jwt, { secret: "01234567890123456789012345678901" });
    app.decorate("authenticate", async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        sendUnauthorized(reply);
      }
    });
    await registerE2EControlRoutes(app, runtime);
    await registerFoodEntryCorrectionRoutes(app, {
      repository,
      classify: runtime.classifyCorrection,
    });

    const modeResponse = await app.inject({
      method: "POST",
      url: "/__e2e/ai-mode",
      headers: { "x-e2e-control-secret": SECRET },
      payload: { correction: "failure" },
    });
    const token = app.jwt.sign({ sub: "user-1" });
    const correctionResponse = await app.inject({
      method: "POST",
      url: "/ai/entries/00000000-0000-4000-8000-000000000001/correction",
      headers: { authorization: `Bearer ${token}` },
      payload: { instruction: "double it", preferredLanguage: "en" },
    });

    expect(modeResponse.statusCode).toBe(200);
    expect(correctionResponse.statusCode).toBe(502);
    expect(stored).toEqual(before);
    expect(updateEntry).not.toHaveBeenCalled();
  });
});
