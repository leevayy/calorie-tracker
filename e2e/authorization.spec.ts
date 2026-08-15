import type { Page } from "@playwright/test";
import {
  behavioralIsoDay,
  expect,
  isolatedTestUser,
  loginThroughSetup,
  openSettingsThroughVisibleUi,
  test,
  type E2ESetupSession,
  type E2ETestUser,
} from "./support/fixtures";

type ApiFoodEntry = {
  id: string;
  day: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  portion?: string;
};

type ApiDayLog = {
  day: string;
  totalCalories: number;
  meals: {
    breakfast: ApiFoodEntry[];
    lunch: ApiFoodEntry[];
    dinner: ApiFoodEntry[];
    snack?: ApiFoodEntry[];
  };
};

function displayDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

function apiUrl(pathname: string): string {
  const origin = process.env.E2E_API_URL?.trim() || "http://127.0.0.1:3000";
  return new URL(pathname, `${origin.replace(/\/$/, "")}/`).toString();
}

async function requestThroughSession<T>(
  session: E2ESetupSession,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  pathname: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const response = await fetch(apiUrl(pathname), {
    method,
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as T };
}

async function signOutThroughVisibleUi(page: Page): Promise<void> {
  await openSettingsThroughVisibleUi(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
}

function ownerAndAttacker(ownerEntries: E2ETestUser["entries"]): {
  owner: E2ETestUser;
  attacker: E2ETestUser;
} {
  return {
    owner: isolatedTestUser({
      email: "playwright-owner@example.invalid",
      entries: ownerEntries,
    }),
    attacker: isolatedTestUser({
      email: "playwright-attacker@example.invalid",
      entries: [],
    }),
  };
}

test.describe("Authorization boundaries", () => {
  test("cannot read, edit, delete, or restore another user's food entry", async ({
    page,
    e2eControls,
  }) => {
    const day = behavioralIsoDay();
    const ownerName = "Owner-only breakfast bowl";
    const { owner, attacker } = ownerAndAttacker([
      {
        day,
        mealType: "breakfast",
        name: ownerName,
        calories: 410,
        protein: 28,
        carbs: 46,
        fats: 13,
        fiber: 8,
        portion: "1 bowl",
        mealSlug: "owner-breakfast-bowl",
      },
    ]);
    const seeded = await e2eControls.reset([owner, attacker]);
    const ownerEntryId = seeded.users[0]?.entryIds[0];
    expect(ownerEntryId).toBeTruthy();
    let session = await loginThroughSetup(page, attacker);

    const readAttempt = await requestThroughSession<ApiDayLog>(session, "GET", `/api/v1/days/${day}`);
    expect(readAttempt.status).toBe(200);
    expect(readAttempt.body.totalCalories).toBe(0);
    expect(Object.values(readAttempt.body.meals).flat()).toEqual([]);

    const replacement = {
      day,
      mealType: "dinner",
      name: "Cross-user overwrite",
      calories: 1,
      protein: 1,
      carbs: 1,
      fats: 1,
      fiber: 1,
      portion: "1 serving",
    };
    const editAttempt = await requestThroughSession<{ message: string }>(
      session,
      "PATCH",
      `/api/v1/entries/${ownerEntryId}`,
      replacement,
    );
    const deleteAttempt = await requestThroughSession<{ message: string }>(
      session,
      "DELETE",
      `/api/v1/entries/${ownerEntryId}`,
    );
    const restoreAttempt = await requestThroughSession<{ message: string }>(
      session,
      "POST",
      `/api/v1/entries/${ownerEntryId}/restore`,
    );
    expect([editAttempt.status, deleteAttempt.status, restoreAttempt.status]).toEqual([
      404,
      404,
      404,
    ]);

    await signOutThroughVisibleUi(page);
    session = await loginThroughSetup(page, owner);
    await expect(page.getByRole("button", { name: /^Breakfast\b/ })).toContainText("410 cal");
    await page.getByRole("button", { name: /^Breakfast\b/ }).click();
    await expect(page.getByRole("button", { name: new RegExp(`^${ownerName}\\b`) })).toBeVisible();

    const ownerDay = await requestThroughSession<ApiDayLog>(session, "GET", `/api/v1/days/${day}`);
    expect(ownerDay.status).toBe(200);
    expect(ownerDay.body.meals.breakfast).toEqual([
      expect.objectContaining({
        id: ownerEntryId,
        name: ownerName,
        calories: 410,
        protein: 28,
        carbs: 46,
        fats: 13,
        fiber: 8,
      }),
    ]);
  });

  test("cannot open or duplicate another user's historical meal", async ({
    page,
    e2eControls,
  }) => {
    const sourceDay = behavioralIsoDay(-1);
    const destinationDay = behavioralIsoDay();
    const ownerName = "Owner-only historical salmon";
    const { owner, attacker } = ownerAndAttacker([
      {
        day: sourceDay,
        mealType: "dinner",
        name: ownerName,
        calories: 515,
        protein: 44,
        carbs: 24,
        fats: 27,
        fiber: 6,
        portion: "1 plate",
        mealSlug: "owner-salmon-plate",
      },
    ]);
    await e2eControls.reset([owner, attacker]);
    let session = await loginThroughSetup(page, attacker);

    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page).toHaveURL(/\/history$/);
    await page
      .getByRole("button", { name: `Open log for ${displayDay(sourceDay)}`, exact: true })
      .click();
    const attackerDetail = page.getByRole("region", {
      name: displayDay(sourceDay),
      exact: true,
    });
    await expect(attackerDetail).toBeVisible();
    await expect(attackerDetail.getByText("No log for this day.", { exact: true })).toBeVisible();
    await expect(attackerDetail.getByText(ownerName, { exact: true })).toHaveCount(0);
    await expect(attackerDetail.getByRole("button", { name: "Duplicate Dinner" })).toHaveCount(0);

    const duplicateAttempt = await requestThroughSession<{ message: string }>(
      session,
      "POST",
      "/api/v1/meals/duplicate",
      {
        sourceDay,
        sourceMealType: "dinner",
        destinationDay,
        destinationMealType: "lunch",
      },
    );
    expect(duplicateAttempt.status).toBe(404);
    const attackerDestination = await requestThroughSession<ApiDayLog>(
      session,
      "GET",
      `/api/v1/days/${destinationDay}`,
    );
    expect(attackerDestination.body.totalCalories).toBe(0);
    expect(Object.values(attackerDestination.body.meals).flat()).toEqual([]);

    await attackerDetail.getByRole("button", { name: "Back to history" }).click();
    await signOutThroughVisibleUi(page);
    session = await loginThroughSetup(page, owner);
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page
      .getByRole("button", { name: `Open log for ${displayDay(sourceDay)}`, exact: true })
      .click();
    const ownerDetail = page.getByRole("region", {
      name: displayDay(sourceDay),
      exact: true,
    });
    await expect(ownerDetail).toBeVisible();
    await ownerDetail.getByRole("button", { name: /^Dinner\b/ }).click();
    await expect(ownerDetail.getByRole("button", { name: new RegExp(`^${ownerName}\\b`) })).toBeVisible();
    await expect(ownerDetail.getByRole("button", { name: "Duplicate Dinner" })).toBeEnabled();

    const ownerSource = await requestThroughSession<ApiDayLog>(
      session,
      "GET",
      `/api/v1/days/${sourceDay}`,
    );
    expect(ownerSource.body.totalCalories).toBe(515);
    expect(ownerSource.body.meals.dinner).toEqual([
      expect.objectContaining({ name: ownerName, calories: 515 }),
    ]);
  });
});
