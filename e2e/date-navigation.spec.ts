import type { Page, Request } from "@playwright/test";
import {
  expect,
  isolatedTestUser,
  loginThroughSetup,
  test,
  type E2EControlClient,
  type E2ESeedEntry,
} from "./support/fixtures";
import {
  openAdaptiveFoodComposer,
  usesDesktopWorkspace,
} from "./support/adaptiveComposer";

const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
} as const;

type MealType = keyof typeof MEAL_LABELS;

const LOCALIZED_DATE_NAVIGATION = [
  {
    code: "ru" as const,
    navigation: "Дата записи",
    dateInput: "Дата",
    selectedDate: "Суббота, 31 декабря 2039 г.",
  },
  {
    code: "pl" as const,
    navigation: "Data dziennika",
    dateInput: "Data",
    selectedDate: "Sobota, 31 grudnia 2039",
  },
  {
    code: "tt" as const,
    navigation: "Көндәлек датасы",
    dateInput: "Дата",
    selectedDate: "31 декабрь, 2039 ел, шимбә",
  },
] as const;

function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

async function behavioralToday(page: Page): Promise<string> {
  return page.evaluate(() => {
    const date = new Date();
    if (date.getUTCHours() < 4) date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  });
}

function seedEntry(
  day: string,
  name: string,
  calories: number,
  overrides: Partial<E2ESeedEntry> = {},
): E2ESeedEntry {
  return {
    day,
    mealType: "breakfast",
    name,
    calories,
    protein: 10,
    carbs: 20,
    fats: 5,
    fiber: 3,
    portion: "1 saved serving",
    mealSlug: name.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, ""),
    ...overrides,
  };
}

async function seedAndLogin(
  page: Page,
  e2eControls: E2EControlClient,
  entries: E2ESeedEntry[],
) {
  const user = isolatedTestUser({ entries });
  await e2eControls.reset([user]);
  await loginThroughSetup(page, user);
}

const openFoodComposer = openAdaptiveFoodComposer;

function nextParseRequest(page: Page): Promise<Request> {
  return page.waitForRequest((request) => {
    const url = new URL(request.url());
    return request.method() === "POST" && url.pathname === "/api/v1/ai/parse-food";
  });
}

function nextBatchRequest(page: Page): Promise<Request> {
  return page.waitForRequest((request) => {
    const url = new URL(request.url());
    return request.method() === "POST" && url.pathname === "/api/v1/entries/batch";
  });
}

function nextBatchResponse(page: Page) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "POST" && url.pathname === "/api/v1/entries/batch";
  });
}

function mealButton(page: Page, mealType: MealType) {
  if (usesDesktopWorkspace(page)) {
    return page
      .getByRole("region", { name: MEAL_LABELS[mealType], exact: true })
      .getByRole("button", { name: MEAL_LABELS[mealType], exact: true });
  }
  return page.getByRole("button", {
    name: new RegExp(`^${MEAL_LABELS[mealType]}\\b`),
  });
}

async function expectMealCalories(
  page: Page,
  mealType: MealType,
  calories: number,
): Promise<void> {
  if (!usesDesktopWorkspace(page)) {
    await expect(page.getByRole("button", {
      name: new RegExp(`^${MEAL_LABELS[mealType]}\\b.*${calories}\\s+kcal`),
    })).toBeVisible();
    return;
  }

  const meal = page.getByRole("region", { name: MEAL_LABELS[mealType], exact: true });
  await expect(meal).toBeVisible();
  const calorieCells = meal.getByRole("cell").filter({ hasText: /\bkcal\b/ });
  await expect.poll(async () => {
    const values = await calorieCells.allTextContents();
    return values.reduce((sum, value) => sum + Number(value.replace(/[^\d.-]/g, "")), 0);
  }).toBe(calories);
}

async function revealMeal(page: Page, mealType: MealType): Promise<void> {
  const control = mealButton(page, mealType);
  if (!usesDesktopWorkspace(page) || (await control.getAttribute("aria-expanded")) !== "true") {
    await control.click();
  }
}

async function returnToToday(page: Page): Promise<void> {
  await returnToTodayControl(page).click();
}

function returnToTodayControl(page: Page) {
  return page
    .locator('[data-slot="date-navigator-today"]')
    .getByRole("button");
}

function dateNavigation(page: Page, accessibleName = "Log date") {
  return page.getByRole("group", { name: accessibleName, exact: true });
}

function selectedDateControl(page: Page, navigationName = "Log date") {
  return dateNavigation(page, navigationName).getByRole("button").nth(1);
}

async function selectedDateLabel(page: Page): Promise<string> {
  return selectedDateControl(page).innerText();
}

async function selectDirectDay(
  page: Page,
  day: string,
  navigationName = "Log date",
  dateInputName = "Date",
): Promise<void> {
  await selectedDateControl(page, navigationName).click();
  const dateInput = page.getByLabel(dateInputName, { exact: true });
  await expect(dateInput).toBeVisible();
  await dateInput.fill(day);
  await expect(dateInput).toBeHidden();
}

test.describe("Dashboard date navigation", () => {
  test("navigates previous and next dates and labels the selected day", async ({
    page,
    e2eControls,
  }) => {
    await seedAndLogin(page, e2eControls, []);
    const todayLabel = await selectedDateLabel(page);

    await page.getByRole("button", { name: "Next day" }).click();
    const tomorrowLabel = await selectedDateLabel(page);
    expect(tomorrowLabel).not.toBe(todayLabel);
    const todayControl = returnToTodayControl(page);
    await expect(todayControl).toBeVisible();
    if (usesDesktopWorkspace(page)) {
      const header = page.getByTestId("desktop-journal-header");
      const selectedDateBox = await selectedDateControl(page).boundingBox();
      const returnToTodayBox = await todayControl.boundingBox();
      const headerBox = await header.boundingBox();
      expect(selectedDateBox).not.toBeNull();
      expect(returnToTodayBox).not.toBeNull();
      expect(headerBox).not.toBeNull();
      if (selectedDateBox && returnToTodayBox && headerBox) {
        expect(selectedDateBox.y).toBeGreaterThanOrEqual(headerBox.y);
        expect(selectedDateBox.y + selectedDateBox.height).toBeLessThanOrEqual(
          headerBox.y + headerBox.height + 1,
        );
        expect(returnToTodayBox.y).toBeGreaterThanOrEqual(headerBox.y);
        expect(returnToTodayBox.y + returnToTodayBox.height).toBeLessThanOrEqual(
          headerBox.y + headerBox.height + 1,
        );
      }
    } else {
      const selectedDateBox = await selectedDateControl(page).boundingBox();
      const returnToTodayBox = await todayControl.boundingBox();
      expect(selectedDateBox).not.toBeNull();
      expect(returnToTodayBox).not.toBeNull();
      if (selectedDateBox && returnToTodayBox) {
        expect(returnToTodayBox.y).toBeGreaterThanOrEqual(
          selectedDateBox.y + selectedDateBox.height,
        );
      }
    }

    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(selectedDateControl(page)).toHaveText(todayLabel);
    await expect(returnToTodayControl(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Previous day" }).click();
    const yesterdayLabel = await selectedDateLabel(page);
    expect(yesterdayLabel).not.toBe(todayLabel);
    expect(yesterdayLabel).not.toBe(tomorrowLabel);
  });

  test("keeps the selected day and its totals while navigating", async ({
    page,
    e2eControls,
  }) => {
    const today = await behavioralToday(page);
    await seedAndLogin(page, e2eControls, [
      seedEntry(today, "Today breakfast", 100),
      seedEntry(addDays(today, -1), "Previous dinner", 250, { mealType: "dinner" }),
    ]);
    const todayLabel = await selectedDateLabel(page);
    await expectMealCalories(page, "breakfast", 100);
    await expectMealCalories(page, "dinner", 0);

    await page.getByRole("button", { name: "Previous day" }).click();
    const previousLabel = await selectedDateLabel(page);
    expect(previousLabel).not.toBe(todayLabel);
    await expectMealCalories(page, "breakfast", 0);
    await expectMealCalories(page, "dinner", 250);
    await revealMeal(page, "dinner");
    await expect(page.getByText("Previous dinner", { exact: true })).toBeVisible();
    await expect(selectedDateControl(page)).toHaveText(previousLabel);

    await page.getByRole("button", { name: "Next day" }).click();
    await expect(selectedDateControl(page)).toHaveText(todayLabel);
    await expectMealCalories(page, "breakfast", 100);
    await expectMealCalories(page, "dinner", 0);
  });

  test("logs AI and historical suggestions into the selected day only", async ({
    page,
    e2eControls,
  }) => {
    const today = await behavioralToday(page);
    const selectedDay = addDays(today, -1);
    await seedAndLogin(page, e2eControls, [
      seedEntry(addDays(today, -10), "Stored date porridge", 222, {
        portion: "250 g",
        protein: 9,
        carbs: 41,
        fats: 3,
        fiber: 6,
        mealSlug: "stored-date-porridge",
      }),
    ]);
    await e2eControls.setAiMode({ parseFood: "success" });
    await page.getByRole("button", { name: "Previous day" }).click();

    const input = await openFoodComposer(page);
    const parseRequestPromise = nextParseRequest(page);
    const aiBatchPromise = nextBatchRequest(page);
    await input.fill("AI oatmeal for selected day");
    await input.press("Enter");
    const parseRequest = await parseRequestPromise;
    const aiBatch = await aiBatchPromise;
    await expect(page.getByText(usesDesktopWorkspace(page) ? "Added 1 food" : "Added 1", {
      exact: true,
    })).toHaveCount(1);

    const parseBody = parseRequest.postDataJSON() as {
      defaultLogDay: string;
      defaultMealType: MealType;
    };
    const aiBody = aiBatch.postDataJSON() as {
      entries: Array<{ day: string; mealType: MealType; name: string }>;
    };
    expect(parseBody.defaultLogDay).toBe(selectedDay);
    expect(aiBody.entries[0]).toEqual(
      expect.objectContaining({ day: selectedDay, name: "E2E oatmeal" }),
    );

    await input.fill("Stored date porridge");
    const historicalOption = page
      .getByRole("listbox", { name: "Previous entries" })
      .getByRole("option", { name: /Stored date porridge/ });
    await expect(historicalOption).toBeVisible();
    const historicalBatchPromise = nextBatchRequest(page);
    await historicalOption.click();
    const historicalBatch = await historicalBatchPromise;
    if (usesDesktopWorkspace(page)) {
      await expect(page.getByText("Added 1 food", { exact: true })).toHaveCount(1);
    } else {
      const activity = page.getByRole("button", {
        name: "Logging activity · 2 groups logged · 2 foods",
        exact: true,
      });
      await expect(activity).toHaveAttribute("aria-expanded", "false");
      await activity.click();
      await expect(page.getByText("Added 1", { exact: true })).toHaveCount(2);
    }
    const historicalBody = historicalBatch.postDataJSON() as {
      entries: Array<{ day: string; mealType: MealType; name: string; calories: number }>;
    };
    expect(historicalBody.entries[0]).toEqual(
      expect.objectContaining({
        day: selectedDay,
        name: "Stored date porridge",
        calories: 222,
      }),
    );

    const targetMeal = aiBody.entries[0]?.mealType;
    expect(targetMeal).toBe(historicalBody.entries[0]?.mealType);
    await page.reload();
    await page.getByRole("button", { name: "Previous day" }).click();
    await revealMeal(page, targetMeal as MealType);
    await expect(page.getByText("E2E oatmeal", { exact: true })).toBeVisible();
    await expect(page.getByText("Stored date porridge", { exact: true })).toBeVisible();
    await expectMealCalories(page, targetMeal as MealType, 542);

    await returnToToday(page);
    await expect(page.getByText("E2E oatmeal", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Stored date porridge", { exact: true })).toHaveCount(0);
    await expectMealCalories(page, targetMeal as MealType, 0);
  });

  test("returns directly to today from another date", async ({ page, e2eControls }) => {
    await seedAndLogin(page, e2eControls, []);
    const todayLabel = await selectedDateLabel(page);
    await page.getByRole("button", { name: "Previous day" }).click();
    await page.getByRole("button", { name: "Previous day" }).click();
    expect(await selectedDateLabel(page)).not.toBe(todayLabel);

    await returnToToday(page);
    await expect(selectedDateControl(page)).toHaveText(todayLabel);
    await expect(returnToTodayControl(page)).toHaveCount(0);
  });

  test("does not leak submissions across calendar-day boundaries", async ({
    page,
    e2eControls,
  }) => {
    const today = await behavioralToday(page);
    await seedAndLogin(page, e2eControls, []);
    await e2eControls.setAiMode({ parseFood: "delay", delayMs: 1_200 });
    const todayLabel = await selectedDateLabel(page);
    const input = await openFoodComposer(page);
    const parseRequestPromise = nextParseRequest(page);
    const batchResponsePromise = nextBatchResponse(page);

    await input.fill("boundary oatmeal submitted on today");
    await input.press("Enter");
    const parseRequest = await parseRequestPromise;
    const parseBody = parseRequest.postDataJSON() as {
      defaultLogDay: string;
      defaultMealType: MealType;
    };
    expect(parseBody.defaultLogDay).toBe(today);

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Previous day" }).click();
    const previousLabel = await selectedDateLabel(page);
    expect(previousLabel).not.toBe(todayLabel);
    expect((await batchResponsePromise).status()).toBe(201);
    await expectMealCalories(page, parseBody.defaultMealType, 0);

    await returnToToday(page);
    await expectMealCalories(page, parseBody.defaultMealType, 320);
    await revealMeal(page, parseBody.defaultMealType);
    await expect(page.getByText("E2E oatmeal", { exact: true })).toBeVisible();

    await page.reload();
    await revealMeal(page, parseBody.defaultMealType);
    await expect(page.getByText("E2E oatmeal", { exact: true })).toBeVisible();
    await expectMealCalories(page, parseBody.defaultMealType, 320);
  });

  test("directly selects a date across a month and year boundary with destination labels", async ({
    page,
    e2eControls,
  }) => {
    await seedAndLogin(page, e2eControls, []);
    await selectDirectDay(page, "2039-12-31");

    await expect(selectedDateControl(page)).toHaveAccessibleName(
      "Choose date, currently Saturday, December 31, 2039",
    );
    await expect(
      dateNavigation(page).getByRole("button", {
        name: "Previous day, Friday, December 30, 2039",
        exact: true,
      }),
    ).toBeVisible();
    const next = dateNavigation(page).getByRole("button", {
      name: "Next day, Sunday, January 1, 2040",
      exact: true,
    });
    await expect(next).toBeVisible();

    await next.click();

    await expect(selectedDateControl(page)).toHaveAccessibleName(
      "Choose date, currently Sunday, January 1, 2040",
    );
  });

  test("keeps keyboard focus, announces one selected day, and returns to Today without shifting", async ({
    page,
    e2eControls,
  }) => {
    await seedAndLogin(page, e2eControls, []);
    const todayLabel = await selectedDateLabel(page);
    const navigator = dateNavigation(page).locator("..");
    const todaySlot = navigator.locator('[data-slot="date-navigator-today"]');
    const initialSlotBox = usesDesktopWorkspace(page) ? null : await todaySlot.boundingBox();
    if (usesDesktopWorkspace(page)) {
      await expect(todaySlot).toHaveCount(0);
    } else {
      await expect(todaySlot).toHaveCount(1);
    }
    await expect(returnToTodayControl(page)).toHaveCount(0);

    await selectDirectDay(page, "2039-12-31");
    const statuses = navigator.getByRole("status");
    await expect(statuses).toHaveCount(1);
    await expect(statuses).toHaveAttribute("aria-live", "polite");
    await expect(statuses).toHaveText("Selected date: Saturday, December 31, 2039");
    const offTodaySlotBox = await todaySlot.boundingBox();
    expect(offTodaySlotBox).not.toBeNull();
    if (!usesDesktopWorkspace(page)) expect(initialSlotBox).not.toBeNull();
    if (!usesDesktopWorkspace(page) && initialSlotBox && offTodaySlotBox) {
      expect(offTodaySlotBox.height).toBe(initialSlotBox.height);
    }

    const next = dateNavigation(page).getByRole("button").last();
    await next.focus();
    await expect(next).toBeFocused();
    await next.press("Enter");
    await expect(next).toBeFocused();
    await expect(statuses).toHaveCount(1);
    await expect(statuses).toHaveText("Selected date: Sunday, January 1, 2040");

    const todayControl = returnToTodayControl(page);
    await expect(todayControl).toBeVisible();
    await todayControl.focus();
    await expect(todayControl).toBeFocused();
    await todayControl.press("Enter");
    await expect(selectedDateControl(page)).toHaveText(todayLabel);
    await expect(returnToTodayControl(page)).toHaveCount(0);
    const returnedSlotBox = usesDesktopWorkspace(page) ? null : await todaySlot.boundingBox();
    if (!usesDesktopWorkspace(page)) expect(returnedSlotBox).not.toBeNull();
    if (!usesDesktopWorkspace(page) && initialSlotBox && returnedSlotBox) {
      expect(returnedSlotBox.height).toBe(initialSlotBox.height);
    }
  });

  test("contains long Russian Polish and Tatar dates at 320 390 and 430 pixels", async ({
    page,
    e2eControls,
  }) => {
    for (const locale of LOCALIZED_DATE_NAVIGATION) {
      await test.step(locale.code, async () => {
        const user = isolatedTestUser({
          profile: {
            dailyCalorieGoal: 2_000,
            weightKg: 70,
            heightCm: 175,
            preferredLanguage: locale.code,
            nutritionGoal: "maintain",
          },
        });
        await e2eControls.reset([user]);
        await page.setViewportSize({ width: 320, height: 844 });
        await loginThroughSetup(page, user);
        await selectDirectDay(
          page,
          "2039-12-31",
          locale.navigation,
          locale.dateInput,
        );

        for (const width of [320, 390, 430]) {
          await test.step(`${width}px`, async () => {
            await page.setViewportSize({ width, height: 844 });
            const navigation = dateNavigation(page, locale.navigation);
            const selected = selectedDateControl(page, locale.navigation);
            await expect(selected).toHaveText(locale.selectedDate);
            const geometry = await selected.evaluate((element) => {
              const root = document.documentElement;
              const style = getComputedStyle(element);
              const box = element.getBoundingClientRect();
              return {
                documentWidth: Math.max(root.scrollWidth, document.body.scrollWidth),
                viewportWidth: root.clientWidth,
                left: box.left,
                right: box.right,
                whiteSpace: style.whiteSpace,
                selectedScrollWidth: element.scrollWidth,
                selectedClientWidth: element.clientWidth,
              };
            });
            const navigationBox = await navigation.boundingBox();
            expect(navigationBox).not.toBeNull();
            expect(geometry.left).toBeGreaterThanOrEqual(0);
            expect(geometry.right).toBeLessThanOrEqual(width);
            expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
            expect(geometry.whiteSpace).toBe("normal");
            expect(geometry.selectedScrollWidth).toBeLessThanOrEqual(
              geometry.selectedClientWidth + 1,
            );
          });
        }
      });
    }
  });

  test("fits localized dates in the one-row desktop journal header", async ({
    page,
    e2eControls,
  }) => {
    if (!usesDesktopWorkspace(page)) {
      const locale = LOCALIZED_DATE_NAVIGATION[0];
      const user = isolatedTestUser({
        profile: {
          dailyCalorieGoal: 2_000,
          weightKg: 70,
          heightCm: 175,
          preferredLanguage: locale.code,
          nutritionGoal: "maintain",
        },
      });
      await e2eControls.reset([user]);
      await page.setViewportSize({ width: 390, height: 844 });
      await loginThroughSetup(page, user);
      await selectDirectDay(page, "2039-12-31", locale.navigation, locale.dateInput);

      await expect(page.getByTestId("desktop-journal-header")).toHaveCount(0);
      const navigation = dateNavigation(page, locale.navigation);
      const selected = selectedDateControl(page, locale.navigation);
      await expect(selected).toHaveText(locale.selectedDate);
      const todayControl = returnToTodayControl(page);
      await expect(todayControl).toBeVisible();
      const [navigationBox, selectedBox, todayBox] = await Promise.all([
        navigation.boundingBox(),
        selected.boundingBox(),
        todayControl.boundingBox(),
      ]);
      expect(navigationBox).not.toBeNull();
      expect(selectedBox).not.toBeNull();
      expect(todayBox).not.toBeNull();
      if (navigationBox && selectedBox && todayBox) {
        expect(selectedBox.x).toBeGreaterThanOrEqual(navigationBox.x);
        expect(selectedBox.x + selectedBox.width).toBeLessThanOrEqual(
          navigationBox.x + navigationBox.width + 1,
        );
        expect(todayBox.x).toBeGreaterThanOrEqual(0);
        expect(todayBox.x + todayBox.width).toBeLessThanOrEqual(390);
      }
      return;
    }

    for (const locale of LOCALIZED_DATE_NAVIGATION) {
      await test.step(locale.code, async () => {
        const user = isolatedTestUser({
          profile: {
            dailyCalorieGoal: 2_000,
            weightKg: 70,
            heightCm: 175,
            preferredLanguage: locale.code,
            nutritionGoal: "maintain",
          },
        });
        await e2eControls.reset([user]);
        await page.setViewportSize({ width: 768, height: 900 });
        await loginThroughSetup(page, user);
        await selectDirectDay(page, "2039-12-31", locale.navigation, locale.dateInput);

        const header = page.getByTestId("desktop-journal-header");
        const selected = selectedDateControl(page, locale.navigation);
        await expect(selected).toHaveAttribute("aria-label", new RegExp(locale.selectedDate));
        for (const viewport of [
          { width: 768, height: 900 },
          { width: 900, height: 1_024 },
          { width: 1_280, height: 720 },
          { width: 1_440, height: 900 },
        ]) {
          await test.step(`${viewport.width}x${viewport.height}`, async () => {
            await page.setViewportSize(viewport);
            await expect(returnToTodayControl(page)).toBeVisible();
            const geometry = await header.evaluate((element) => {
              const children = [...element.children].map((child) => child.getBoundingClientRect());
              const bounds = element.getBoundingClientRect();
              const today = element.querySelector('[data-slot="date-navigator-today"] button')?.getBoundingClientRect();
              return {
                oneRow: children.every((rect) => Math.abs(rect.top - children[0]!.top) < 2),
                contained: children.every((rect) => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1),
                todayContained: Boolean(today && today.left >= bounds.left - 1 && today.right <= bounds.right + 1),
                todayOnRow: Boolean(today && Math.abs(
                  today.top + today.height / 2 - (children[0]!.top + children[0]!.height / 2),
                ) < 2),
                noDocumentOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
              };
            });
            expect(geometry).toEqual({
              oneRow: true,
              contained: true,
              todayContained: true,
              todayOnRow: true,
              noDocumentOverflow: true,
            });
          });
        }
      });
    }
  });
});
