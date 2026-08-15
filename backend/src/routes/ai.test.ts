import jwt from "@fastify/jwt";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { sendUnauthorized } from "../lib/http.ts";
import { registerAiRoutes, type AiRouteDependencies } from "./ai.ts";

const { findUser, parseFoodTextWithAi } = vi.hoisted(() => ({
  findUser: vi.fn(),
  parseFoodTextWithAi: vi.fn(),
}));

vi.mock("../db/client.ts", () => ({
  db: { query: { usersTable: { findFirst: findUser } } },
}));
vi.mock("../env.ts", () => ({
  env: { AI_MODEL_PREFERENCE: "qwen36" },
}));
vi.mock("../services/ai.ts", () => ({ parseFoodTextWithAi }));

const apps: FastifyInstance[] = [];

async function buildTestApp(overrides: Partial<AiRouteDependencies> = {}) {
  const app = Fastify();
  apps.push(app);
  await app.register(jwt, { secret: "01234567890123456789012345678901" });
  app.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      sendUnauthorized(reply);
    }
  });
  await registerAiRoutes(app, overrides);
  return {
    app,
    token: app.jwt.sign({ sub: "user-1" }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findUser.mockResolvedValue({
    id: "user-1",
    nutritionGoal: "fat_loss",
    // Legacy rows may still contain this column, but it must not drive parsing.
    aiModelPreference: "alicegpt",
  });
  parseFoodTextWithAi.mockResolvedValue([]);
});

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("AI food parse model routing", () => {
  test("uses the server-selected model instead of the user's legacy preference", async () => {
    const { app, token } = await buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/ai/parse-food",
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

    expect(response.statusCode).toBe(200);
    expect(parseFoodTextWithAi).toHaveBeenCalledWith(
      "oats",
      "en",
      "fat_loss",
      "qwen36",
      {
        localDate: "2026-08-15",
        localTimeHm: "08:00",
        clientTimeZone: "Europe/Moscow",
        defaultLogDay: "2026-08-15",
        defaultMealType: "breakfast",
      },
    );
  });

  test("uses a composition-time parse provider override", async () => {
    const parseFood = vi.fn().mockResolvedValue([]);
    const { app, token } = await buildTestApp({ parseFood });

    const response = await app.inject({
      method: "POST",
      url: "/ai/parse-food",
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

    expect(response.statusCode).toBe(200);
    expect(parseFood).toHaveBeenCalledOnce();
    expect(parseFoodTextWithAi).not.toHaveBeenCalled();
  });
});
