import jwt from "@fastify/jwt";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, test } from "vitest";
import { sendUnauthorized } from "../lib/http.ts";
import type { FoodEntryRecord } from "../services/foodLogRepository.ts";
import type { FoodEntryCorrectionClassifierInput } from "../services/foodEntryCorrection.ts";
import { registerFoodEntryCorrectionRoutes } from "./food-entry-correction.ts";

const USER_ID = "user-1";
const ENTRY_ID = "10000000-0000-4000-8000-000000000001";

function entry(overrides: Partial<FoodEntryRecord> = {}): FoodEntryRecord {
  return {
    id: ENTRY_ID,
    userId: USER_ID,
    day: "2026-08-15",
    mealType: "breakfast",
    name: "Oatmeal",
    calories: 320,
    protein: 14,
    carbs: 52,
    fats: 7,
    fiber: 8,
    portion: "1 bowl",
    mealSlug: "oatmeal",
    createdAt: new Date("2026-08-15T08:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

const apps: FastifyInstance[] = [];

async function buildTestApp(options: {
  entries?: FoodEntryRecord[];
  classify: (input: FoodEntryCorrectionClassifierInput) => Promise<unknown>;
}) {
  const entries = (options.entries ?? [entry()]).map((item) => ({ ...item }));
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
  await registerFoodEntryCorrectionRoutes(app, {
    repository: {
      async findActiveEntry(userId, entryId) {
        const found = entries.find(
          (item) => item.userId === userId && item.id === entryId && item.deletedAt === null,
        );
        return found ? { ...found } : null;
      },
    },
    classify: options.classify,
  });
  return {
    app,
    entries,
    tokenFor: (userId: string) => app.jwt.sign({ sub: userId }),
  };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("food entry correction routes", () => {
  test("returns a complete draft derived from the owned stored entry", async () => {
    let classifierInput: FoodEntryCorrectionClassifierInput | undefined;
    const { app, tokenFor, entries } = await buildTestApp({
      classify: async (input) => {
        classifierInput = input;
        return { kind: "scale", factor: 2 };
      },
    });
    const before = entries.map((item) => ({ ...item }));

    const response = await app.inject({
      method: "POST",
      url: `/ai/entries/${ENTRY_ID}/correction`,
      headers: { authorization: `Bearer ${tokenFor(USER_ID)}` },
      payload: { instruction: "Double the calories", preferredLanguage: "en" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      draft: {
        name: "Oatmeal",
        portion: "1 bowl",
        calories: 640,
        protein: 28,
        carbs: 104,
        fats: 14,
        fiber: 16,
        day: "2026-08-15",
        mealType: "breakfast",
      },
    });
    expect(classifierInput).toEqual({
      current: {
        name: "Oatmeal",
        portion: "1 bowl",
        calories: 320,
        protein: 14,
        carbs: 52,
        fats: 7,
        fiber: 8,
        day: "2026-08-15",
        mealType: "breakfast",
      },
      instruction: "Double the calories",
      preferredLanguage: "en",
    });
    expect(entries).toEqual(before);
  });

  test("requires authentication", async () => {
    const { app } = await buildTestApp({
      classify: async () => ({ kind: "scale", factor: 2 }),
    });

    const response = await app.inject({
      method: "POST",
      url: `/ai/entries/${ENTRY_ID}/correction`,
      payload: { instruction: "Double it", preferredLanguage: "en" },
    });

    expect(response.statusCode).toBe(401);
  });

  test("does not reveal an entry across the ownership boundary", async () => {
    const { app, tokenFor } = await buildTestApp({
      classify: async () => {
        throw new Error("classifier must not receive another user's entry");
      },
    });

    const response = await app.inject({
      method: "POST",
      url: `/ai/entries/${ENTRY_ID}/correction`,
      headers: { authorization: `Bearer ${tokenFor("other-user")}` },
      payload: { instruction: "Double it", preferredLanguage: "en" },
    });

    expect(response.statusCode).toBe(404);
  });

  test("does not correct a deleted entry", async () => {
    const { app, tokenFor } = await buildTestApp({
      entries: [entry({ deletedAt: new Date("2026-08-15T09:00:00.000Z") })],
      classify: async () => ({ kind: "scale", factor: 2 }),
    });

    const response = await app.inject({
      method: "POST",
      url: `/ai/entries/${ENTRY_ID}/correction`,
      headers: { authorization: `Bearer ${tokenFor(USER_ID)}` },
      payload: { instruction: "Double it", preferredLanguage: "en" },
    });

    expect(response.statusCode).toBe(404);
  });

  test.each([
    {
      name: "invalid entry id",
      url: "/ai/entries/not-a-uuid/correction",
      payload: { instruction: "Double it", preferredLanguage: "en" },
    },
    {
      name: "blank instruction",
      url: `/ai/entries/${ENTRY_ID}/correction`,
      payload: { instruction: "   ", preferredLanguage: "en" },
    },
    {
      name: "unsupported language",
      url: `/ai/entries/${ENTRY_ID}/correction`,
      payload: { instruction: "Double it", preferredLanguage: "xx" },
    },
  ])("rejects $name", async ({ url, payload }) => {
    const { app, tokenFor } = await buildTestApp({
      classify: async () => ({ kind: "scale", factor: 2 }),
    });

    const response = await app.inject({
      method: "POST",
      url,
      headers: { authorization: `Bearer ${tokenFor(USER_ID)}` },
      payload,
    });

    expect(response.statusCode).toBe(400);
  });

  test("ignores client-supplied context and derives the draft from storage", async () => {
    const { app, tokenFor } = await buildTestApp({
      classify: async () => ({ kind: "scale", factor: 2 }),
    });

    const response = await app.inject({
      method: "POST",
      url: `/ai/entries/${ENTRY_ID}/correction`,
      headers: { authorization: `Bearer ${tokenFor(USER_ID)}` },
      payload: {
        instruction: "Double it",
        preferredLanguage: "en",
        current: {
          name: "Spoofed",
          calories: 1,
          protein: 1,
          carbs: 1,
          fats: 1,
          fiber: 1,
          day: "2020-01-01",
          mealType: "dinner",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().draft).toMatchObject({
      name: "Oatmeal",
      calories: 640,
      day: "2026-08-15",
      mealType: "breakfast",
    });
  });

  test("returns 422 when the instruction is ambiguous", async () => {
    const { app, tokenFor, entries } = await buildTestApp({
      classify: async () => ({ kind: "reject", reason: "ambiguous" }),
    });
    const before = entries.map((item) => ({ ...item }));

    const response = await app.inject({
      method: "POST",
      url: `/ai/entries/${ENTRY_ID}/correction`,
      headers: { authorization: `Bearer ${tokenFor(USER_ID)}` },
      payload: { instruction: "Make it right", preferredLanguage: "en" },
    });

    expect(response.statusCode).toBe(422);
    expect(entries).toEqual(before);
  });

  test.each([
    {
      name: "schema-invalid classifier output",
      classify: async () => ({ kind: "scale", factor: "two" }),
    },
    {
      name: "provider failure",
      classify: async () => {
        throw new Error("provider unavailable");
      },
    },
  ])("returns 502 for $name without persisting", async ({ classify }) => {
    const { app, tokenFor, entries } = await buildTestApp({ classify });
    const before = entries.map((item) => ({ ...item }));

    const response = await app.inject({
      method: "POST",
      url: `/ai/entries/${ENTRY_ID}/correction`,
      headers: { authorization: `Bearer ${tokenFor(USER_ID)}` },
      payload: { instruction: "Double it", preferredLanguage: "en" },
    });

    expect(response.statusCode).toBe(502);
    expect(entries).toEqual(before);
  });
});
