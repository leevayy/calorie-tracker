import type { Page, Request } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { expectAppBackgroundExcludedFromAccessibilityTree } from "./support/modalAccessibility";

const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
} as const;

type MealType = keyof typeof MEAL_LABELS;
type ParseFoodRequestBody = {
  text: string;
  defaultLogDay: string;
  defaultMealType: MealType;
};

async function openFoodComposer(page: Page) {
  await page.getByRole("button", { name: /Log food/ }).click();
  const input = page.getByRole("combobox", { name: "Log food" });
  await expect(input).toBeVisible();
  return input;
}

function nextParseRequest(page: Page): Promise<Request> {
  return page.waitForRequest((request) => {
    const url = new URL(request.url());
    return request.method() === "POST" && url.pathname === "/api/v1/ai/parse-food";
  });
}

function nextBatchResponse(page: Page) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "POST" && url.pathname === "/api/v1/entries/batch";
  });
}

function nextBatchRequest(page: Page): Promise<Request> {
  return page.waitForRequest((request) => {
    const url = new URL(request.url());
    return request.method() === "POST" && url.pathname === "/api/v1/entries/batch";
  });
}

async function selectDashboardDay(page: Page, day: string): Promise<void> {
  const navigator = page.getByRole("group", { name: "Log date", exact: true });
  await navigator.getByRole("button").nth(1).click();
  const date = page.getByLabel("Date", { exact: true });
  await date.fill(day);
  await expect(date).toBeHidden();
}

async function chooseComposerMeal(page: Page, mealType: MealType): Promise<void> {
  const meal = page.getByRole("combobox", { name: "Meal", exact: true });
  await meal.click();
  await page.getByRole("option", { name: MEAL_LABELS[mealType], exact: true }).click();
  await expect(meal).toHaveText(MEAL_LABELS[mealType]);
}

function explicitNutritionDescription(name: string, calories: number): string {
  return `${name}, portion 1 bowl, ${calories} calories, 12 g protein, 24 g carbs, 8 g fat, 4 g fiber`;
}

function fullEnglishDate(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00.000Z`));
}

function mealButton(page: Page, mealType: MealType, calories?: number) {
  const caloriePattern = calories === undefined ? ".*" : `.*${calories}\\s+kcal`;
  return page.getByRole("button", {
    name: new RegExp(`^${MEAL_LABELS[mealType]}\\b${caloriePattern}`),
  });
}

function mealSection(page: Page, mealType: MealType) {
  return mealButton(page, mealType).locator("..");
}

async function expectOnlyComposerCopyExposed(page: Page, text: string) {
  await expect(
    page.locator("#food-log-sheet").getByText(text, { exact: true }),
  ).toBeVisible();
  expect(
    await page.getByText(text, { exact: true }).evaluateAll(
      (elements) =>
        elements.filter(
          (element) => !element.closest("[inert]") && !element.closest('[aria-hidden="true"]'),
        ).length,
    ),
  ).toBe(1);
}

test.describe("Keyboard-fast food composer", () => {
  test("rotates concise food examples without changing the input label", async ({
    authenticatedPage: page,
  }) => {
    const preview = page.getByTestId("food-placeholder-preview");
    await expect(preview).toHaveAttribute("data-suggestion", "Chicken with mushrooms");
    await expect(preview).toContainText("Chicken with mushrooms");
    await expect(preview).toHaveAttribute("data-typewriter-phase", "holding");
    await expect(preview).toHaveAttribute("data-suggestion", "Ham sandwich");

    await page.getByRole("button", { name: "Log food" }).click();
    const input = page.getByRole("combobox", { name: "Log food" });
    await expectAppBackgroundExcludedFromAccessibilityTree(page);
    const animatedState = await input.evaluate((element) => ({
      placeholder: element.getAttribute("placeholder") ?? "",
      suggestion: element.getAttribute("data-suggestion") ?? "",
    }));
    expect(animatedState.placeholder.length).toBeGreaterThan(0);
    expect(animatedState.suggestion.startsWith(animatedState.placeholder)).toBe(true);

    await input.fill("My own dinner");
    await expect(input).toHaveValue("My own dinner");
    await expect(input).toHaveAccessibleName("Log food");
  });

  test("keeps the label stable and the placeholder coherent with reduced motion", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await e2eControls.setAiMode({ parseFood: "success" });

    const trigger = page.getByRole("button", { name: "Log food" });
    const preview = page.getByTestId("food-placeholder-preview");
    await expect(trigger).toHaveAccessibleName("Log food");
    await expect(preview).toHaveAttribute("data-typewriter-phase", "reduced");
    const stableSuggestion = await preview.getAttribute("data-suggestion");
    expect(stableSuggestion).toBeTruthy();
    await expect(preview).toHaveText(stableSuggestion ?? "");

    await trigger.click();
    const input = page.getByRole("combobox", { name: "Log food" });
    await expect(input).toHaveAccessibleName("Log food");
    await expect(input).toHaveAttribute("data-typewriter-phase", "reduced");
    await expect(input).toHaveAttribute("placeholder", stableSuggestion ?? "");

    const description = "My reduced-motion dinner";
    await input.fill(description);
    await expect(input).toHaveValue(description);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAccessibleName("Log food");
    await expect(preview).toHaveText(description);

    await trigger.click();
    await expect(input).toHaveValue(description);
    const parseRequest = nextParseRequest(page);
    await input.press("Enter");
    await expect(input).toHaveValue("");
    await expect(input).toHaveAccessibleName("Log food");
    await expect(input).toHaveAttribute("data-typewriter-phase", "reduced");
    await expect(input).toHaveAttribute("placeholder", stableSuggestion ?? "");
    await parseRequest;
    await expect(page.getByText("Added 1", { exact: true })).toBeVisible();
  });

  test("submits consecutive entries with Enter and restores composer focus", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "delay", delayMs: 600 });
    const input = await openFoodComposer(page);

    const firstRequestPromise = nextParseRequest(page);
    await input.fill("first consecutive oatmeal");
    await input.press("Enter");
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("");
    const firstRequest = await firstRequestPromise;

    const secondRequestPromise = nextParseRequest(page);
    await input.fill("second consecutive oatmeal");
    await input.press("Enter");
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("");
    const secondRequest = await secondRequestPromise;
    const firstBody = firstRequest.postDataJSON() as ParseFoodRequestBody;
    const secondBody = secondRequest.postDataJSON() as ParseFoodRequestBody;
    expect(secondBody.defaultLogDay).toBe(firstBody.defaultLogDay);
    expect(secondBody.defaultMealType).toBe(firstBody.defaultMealType);

    const activity = page.getByRole("button", {
      name: "Logging activity · 2 groups logged · 2 foods",
      exact: true,
    });
    await expect(input).toBeFocused();
    await expect(activity).toHaveAttribute("aria-expanded", "false");
    await activity.click();
    await expect(page.getByText("Added 1", { exact: true })).toHaveCount(2);

    await page.reload();
    await mealButton(page, firstBody.defaultMealType).click();
    await expect(
      mealSection(page, firstBody.defaultMealType).getByRole("button", { name: /^E2E oatmeal\b/ }),
    ).toHaveCount(2);
    await expect(mealButton(page, firstBody.defaultMealType, 640)).toBeVisible();
  });

  test("shows parsing and saving rows in the target meal", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "delay", delayMs: 1_500 });
    const input = await openFoodComposer(page);
    const parseRequestPromise = nextParseRequest(page);
    const batchResponsePromise = nextBatchResponse(page);

    await input.fill("pending target-meal oatmeal");
    await input.press("Enter");
    const parseRequest = await parseRequestPromise;
    const parseBody = parseRequest.postDataJSON() as ParseFoodRequestBody;
    await expectOnlyComposerCopyExposed(page, "pending target-meal oatmeal");
    await page.keyboard.press("Escape");
    await expect(page.locator("#food-log-sheet")).toBeHidden();

    await expect(page.getByRole("button", { name: /Log food/ })).toBeVisible();
    await expect(
      mealSection(page, parseBody.defaultMealType).getByText(
        "pending target-meal oatmeal",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      mealSection(page, parseBody.defaultMealType).getByText("Understanding…", { exact: true }),
    ).toBeVisible();

    await page.evaluate(() => {
      const trackedWindow = window as Window & { __e2eSawSavingRow?: boolean };
      trackedWindow.__e2eSawSavingRow = false;
      const recordSavingRow = () => {
        if (document.body.innerText.includes("E2E oatmeal") && document.body.innerText.includes("Saving…")) {
          trackedWindow.__e2eSawSavingRow = true;
        }
      };
      new MutationObserver(recordSavingRow).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      recordSavingRow();
    });

    const batchResponse = await batchResponsePromise;
    expect(batchResponse.status()).toBe(201);
    await expect(mealButton(page, parseBody.defaultMealType, 320)).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as Window & { __e2eSawSavingRow?: boolean }).__e2eSawSavingRow,
      ),
    ).toBe(true);

    await page.reload();
    await mealButton(page, parseBody.defaultMealType).click();
    await expect(
      mealSection(page, parseBody.defaultMealType).getByRole("button", { name: /^E2E oatmeal\b/ }),
    ).toBeVisible();
  });

  test("preserves the exact failed submission and retries from the failed stage", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    const parseFailureText = "exact parse failure: 37g oats & milk";
    const saveFailureText = "exact save failure: oatmeal + banana";
    await e2eControls.setAiMode({ parseFood: "failure" });
    const input = await openFoodComposer(page);

    await input.fill(parseFailureText);
    await input.press("Enter");
    await expectOnlyComposerCopyExposed(page, parseFailureText);
    await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await expect(input).toHaveValue("");

    await e2eControls.setAiMode({ parseFood: "success" });
    const parseRetryRequest = nextParseRequest(page);
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    const retryBody = (await parseRetryRequest).postDataJSON() as ParseFoodRequestBody;
    await expect(page.getByText("Added 1", { exact: true })).toHaveCount(1);

    await e2eControls.failNextBatchSave();
    await input.fill(saveFailureText);
    await input.press("Enter");
    await expect(
      page.locator("#food-log-sheet").getByText(saveFailureText, { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("Request failed");
    await expect(input).toHaveValue("");

    await e2eControls.setAiMode({ parseFood: "failure" });
    let retryParseRequests = 0;
    const countParseRequests = (request: Request) => {
      if (new URL(request.url()).pathname === "/api/v1/ai/parse-food") retryParseRequests += 1;
    };
    page.on("request", countParseRequests);
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    const activity = page.getByRole("button", {
      name: "Logging activity · 2 groups logged · 2 foods",
      exact: true,
    });
    await expect(activity).toHaveAttribute("aria-expanded", "false");
    await activity.click();
    await expect(page.getByText("Added 1", { exact: true })).toHaveCount(2);
    page.off("request", countParseRequests);
    expect(retryParseRequests).toBe(0);

    await page.reload();
    await mealButton(page, retryBody.defaultMealType).click();
    await expect(
      mealSection(page, retryBody.defaultMealType).getByRole("button", { name: /^E2E oatmeal\b/ }),
    ).toHaveCount(2);
    await expect(mealButton(page, retryBody.defaultMealType, 640)).toBeVisible();
  });

  test("edits and resubmits a failed description as a new parse attempt", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    const originalText = "exact malformed failure: 37g oats & mlik";
    const editedText = "exact repaired description: 37g oats & milk";
    await e2eControls.setAiMode({ parseFood: "failure" });
    const input = await openFoodComposer(page);

    await input.fill(originalText);
    await input.press("Enter");
    await expectOnlyComposerCopyExposed(page, originalText);
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    const edit = page.getByRole("button", { name: "Edit description", exact: true });
    await edit.focus();
    await page.keyboard.press("Enter");

    await expect(input).toBeFocused();
    await expect(input).toHaveValue(originalText);
    await expect(page.getByText("Editing failed description", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel edit", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();

    await input.fill(editedText);
    await e2eControls.setAiMode({ parseFood: "success" });
    const parseRequestPromise = nextParseRequest(page);
    await input.press("Enter");
    const parseBody = (await parseRequestPromise).postDataJSON() as ParseFoodRequestBody;
    expect(parseBody.text).toBe(editedText);
    await expect(page.getByText("Added 1", { exact: true })).toBeVisible();
    await expect(page.locator("#food-log-sheet").getByText(originalText, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(input).toBeFocused();

    await page.reload();
    await mealButton(page, parseBody.defaultMealType).click();
    await expect(
      mealSection(page, parseBody.defaultMealType).getByRole("button", { name: /^E2E oatmeal\b/ }),
    ).toHaveCount(1);
  });

  test("cancels a failed-description edit without blocking unrelated submissions", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    const failedText = "retained failure: 91g oats + typo";
    const unrelatedDraft = "unrelated yogurt after failure";
    await e2eControls.setAiMode({ parseFood: "failure" });
    const input = await openFoodComposer(page);

    await input.fill(failedText);
    await input.press("Enter");
    await expectOnlyComposerCopyExposed(page, failedText);
    await input.fill(unrelatedDraft);
    await page.getByRole("button", { name: "Edit description", exact: true }).click();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue(failedText);

    await page.getByRole("button", { name: "Cancel edit", exact: true }).click();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue(unrelatedDraft);
    await expect(page.locator("#food-log-sheet").getByText(failedText, { exact: true })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();

    await e2eControls.setAiMode({ parseFood: "success" });
    const unrelatedParseRequest = nextParseRequest(page);
    await input.press("Enter");
    expect(((await unrelatedParseRequest).postDataJSON() as ParseFoodRequestBody).text).toBe(
      unrelatedDraft,
    );
    await expect(page.getByText("Added 1", { exact: true })).toBeVisible();
    await expect(page.locator("#food-log-sheet").getByText(failedText, { exact: true })).toHaveCount(1);

    await page.reload();
    await openFoodComposer(page);
    await expect(page.locator("#food-log-sheet").getByText(failedText, { exact: true })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit description", exact: true })).toBeVisible();
  });

  test("uses the clock-derived meal target and selected dashboard day", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    const selectedDay = "2039-12-31";
    await selectDashboardDay(page, selectedDay);
    await e2eControls.setAiMode({ parseFood: "success" });
    const expectedMeal = await page.evaluate(() => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 11) return "breakfast";
      if (hour >= 11 && hour < 16) return "lunch";
      if (hour >= 16 && hour < 22) return "dinner";
      return "snack";
    }) as MealType;

    const input = await openFoodComposer(page);
    await expect(page.getByRole("combobox", { name: "Meal", exact: true })).toHaveText(
      MEAL_LABELS[expectedMeal],
    );
    const parseRequestPromise = nextParseRequest(page);
    await input.fill("clock-target oatmeal");
    await input.press("Enter");
    const parseBody = (await parseRequestPromise).postDataJSON() as ParseFoodRequestBody;

    expect(parseBody.defaultLogDay).toBe(selectedDay);
    expect(parseBody.defaultMealType).toBe(expectedMeal);
    await expect(page.getByText("Added 1", { exact: true })).toBeVisible();
  });

  test("changes the composer meal target for AI and historical logging", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    const selectedDay = "2039-12-30";
    await selectDashboardDay(page, selectedDay);
    await e2eControls.setAiMode({ parseFood: "success" });
    const input = await openFoodComposer(page);
    await chooseComposerMeal(page, "dinner");

    const aiParsePromise = nextParseRequest(page);
    const aiBatchPromise = nextBatchRequest(page);
    await input.fill("targeted oatmeal");
    await input.press("Enter");
    const aiParse = (await aiParsePromise).postDataJSON() as ParseFoodRequestBody;
    const aiBatch = (await aiBatchPromise).postDataJSON() as {
      entries: Array<{ day: string; mealType: MealType; name: string }>;
    };
    expect(aiParse).toMatchObject({ defaultLogDay: selectedDay, defaultMealType: "dinner" });
    expect(aiBatch.entries).toEqual([
      expect.objectContaining({ day: selectedDay, mealType: "dinner", name: "E2E oatmeal" }),
    ]);
    await expect(page.getByText("Added 1", { exact: true })).toBeVisible();

    await input.fill("E2E oat");
    const option = page.getByRole("listbox", { name: "Previous entries" })
      .getByRole("option", { name: /E2E oatmeal/ });
    await expect(option).toBeVisible();
    await e2eControls.setAiMode({ parseFood: "failure" });
    let parseRequests = 0;
    const countParseRequests = (request: Request) => {
      if (new URL(request.url()).pathname === "/api/v1/ai/parse-food") parseRequests += 1;
    };
    page.on("request", countParseRequests);
    const historicalBatchPromise = nextBatchRequest(page);
    await option.click();
    const historicalBatch = (await historicalBatchPromise).postDataJSON() as {
      entries: Array<{ day: string; mealType: MealType; name: string }>;
    };
    page.off("request", countParseRequests);

    expect(parseRequests).toBe(0);
    expect(historicalBatch.entries).toEqual([
      expect.objectContaining({ day: selectedDay, mealType: "dinner", name: "E2E oatmeal" }),
    ]);
    await expect(page.getByRole("button", {
      name: "Logging activity · 2 groups logged · 2 foods",
      exact: true,
    })).toBeVisible();
  });

  test("lets explicit natural-language meal intent override the selected default", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "explicit-meal" });
    const input = await openFoodComposer(page);
    await chooseComposerMeal(page, "breakfast");
    const parseRequestPromise = nextParseRequest(page);
    const batchRequestPromise = nextBatchRequest(page);

    await input.fill("Soup for dinner");
    await input.press("Enter");
    const parseBody = (await parseRequestPromise).postDataJSON() as ParseFoodRequestBody;
    const batchBody = (await batchRequestPromise).postDataJSON() as {
      entries: Array<{ mealType: MealType }>;
    };

    expect(parseBody.defaultMealType).toBe("breakfast");
    expect(batchBody.entries).toEqual([expect.objectContaining({ mealType: "dinner" })]);
    await expect(page.getByText("Added 1", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Log all|Confirm|Clarify/i })).toHaveCount(0);
  });

  test("retains the selected meal target across consecutive submissions", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "success" });
    const input = await openFoodComposer(page);
    await chooseComposerMeal(page, "snack");
    const parseBodies: ParseFoodRequestBody[] = [];

    for (const description of ["first targeted snack", "second targeted snack"]) {
      const parseRequestPromise = nextParseRequest(page);
      const batchResponsePromise = nextBatchResponse(page);
      await input.fill(description);
      await input.press("Enter");
      parseBodies.push((await parseRequestPromise).postDataJSON() as ParseFoodRequestBody);
      expect((await batchResponsePromise).status()).toBe(201);
      await expect(input).toBeFocused();
    }

    expect(parseBodies.map((body) => body.defaultMealType)).toEqual(["snack", "snack"]);
    await expect(page.getByRole("combobox", { name: "Meal", exact: true })).toHaveText("Snack");
    await expect(page.getByRole("button", {
      name: "Logging activity · 2 groups logged · 2 foods",
      exact: true,
    })).toBeVisible();
  });

  test("keeps a long logging burst compact while suggestions and every receipt remain reachable", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    await e2eControls.setAiMode({ parseFood: "explicit-nutrition" });
    const input = await openFoodComposer(page);

    for (let index = 1; index <= 10; index += 1) {
      const responsePromise = nextBatchResponse(page);
      await input.fill(explicitNutritionDescription(`Burst food ${index}`, 200 + index));
      await input.press("Enter");
      expect((await responsePromise).status()).toBe(201);
      const groupLabel = index === 1 ? "1 group" : `${index} groups`;
      const foodLabel = index === 1 ? "1 food" : `${index} foods`;
      await expect(page.getByRole("button", {
        name: `Logging activity · ${groupLabel} logged · ${foodLabel}`,
        exact: true,
      })).toBeVisible();
    }

    await input.fill("Burst food 10");
    const suggestions = page.getByRole("listbox", { name: "Previous entries" });
    await expect(suggestions.getByRole("option", { name: /Burst food 10/ })).toBeVisible();
    const activity = page.getByRole("button", {
      name: "Logging activity · 10 groups logged · 10 foods",
      exact: true,
    });
    await expect(activity).toHaveAttribute("aria-expanded", "false");
    const geometry = await suggestions.evaluate((list, activitySelector) => {
      const activityElement = document.querySelector(activitySelector);
      const inputElement = document.querySelector<HTMLInputElement>('#food-log-sheet input[aria-label="Log food"]');
      const drawer = document.querySelector("#food-log-sheet");
      let scroller: HTMLElement | null = list.parentElement;
      while (scroller && !["auto", "scroll"].includes(getComputedStyle(scroller).overflowY)) {
        scroller = scroller.parentElement;
      }
      const listBox = list.getBoundingClientRect();
      const inputBox = inputElement?.getBoundingClientRect();
      const drawerBox = drawer?.getBoundingClientRect();
      return {
        activityFollows: Boolean(
          activityElement &&
          (list.compareDocumentPosition(activityElement) & Node.DOCUMENT_POSITION_FOLLOWING),
        ),
        inputBottom: inputBox?.bottom ?? 0,
        listTop: listBox.top,
        listBottom: listBox.bottom,
        drawerBottom: drawerBox?.bottom ?? 0,
        scrollTop: scroller?.scrollTop ?? -1,
      };
    }, '[data-slot="collapsible-trigger"]');
    expect(geometry.activityFollows).toBe(true);
    expect(geometry.listTop).toBeGreaterThanOrEqual(geometry.inputBottom);
    expect(geometry.listBottom).toBeLessThanOrEqual(geometry.drawerBottom + 1);
    expect(geometry.scrollTop).toBe(0);

    await activity.focus();
    await activity.press("Enter");
    await expect(activity).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Added 1", { exact: true })).toHaveCount(10);
    await expect(page.getByRole("button", { name: /^Edit Burst food / })).toHaveCount(10);
    await expect(page.getByRole("button", { name: /^Undo added group: Burst food / })).toHaveCount(10);
    const receiptList = page.locator('[data-slot="collapsible-content"]');
    const bounds = await receiptList.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(bounds.clientHeight).toBeLessThanOrEqual(257);
    expect(bounds.scrollHeight).toBeGreaterThan(bounds.clientHeight);
  });

  test("operates compact receipt Edit and Undo after a selected-day change", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    const receiptDay = "2039-12-29";
    await selectDashboardDay(page, receiptDay);
    await e2eControls.setAiMode({ parseFood: "explicit-nutrition" });
    const input = await openFoodComposer(page);
    for (const [name, calories] of [["Receipt alpha", 301], ["Receipt beta", 302]] as const) {
      const responsePromise = nextBatchResponse(page);
      await input.fill(explicitNutritionDescription(name, calories));
      await input.press("Enter");
      expect((await responsePromise).status()).toBe(201);
    }

    await page.keyboard.press("Escape");
    await expect(page.locator("#food-log-sheet")).toBeHidden();
    await page.getByRole("button", { name: /^Next day,/ }).click();
    await openFoodComposer(page);
    const activity = page.getByRole("button", {
      name: "Logging activity · 2 groups logged · 2 foods",
      exact: true,
    });
    await activity.focus();
    await activity.press("Enter");
    await expect(activity).toHaveAttribute("aria-expanded", "true");
    const receiptList = page.locator('[data-slot="collapsible-content"]');
    await expect(
      receiptList.getByText(new RegExp(`^${fullEnglishDate(receiptDay)} · `)),
    ).toHaveCount(2);
    expect(
      await receiptList.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);

    await page.getByRole("button", { name: "Edit Receipt beta", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Receipt beta", exact: true });
    await expect(editor).toBeVisible();
    await editor.locator('[data-slot="dialog-close"]').click();
    await expect(editor).toBeHidden();

    await openFoodComposer(page);
    await page.getByRole("button", {
      name: "Undo added group: Receipt alpha",
      exact: true,
    }).click();
    await expect(page.getByRole("button", {
      name: "Logging activity · 1 group logged · 1 food",
      exact: true,
    })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Receipt alpha", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit Receipt beta", exact: true })).toBeVisible();
  });

  test("honors explicit portion and nutrition values over inference", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    const explicitDescription =
      "E2E trail mix, portion 37 g, 913 calories, 17 g protein, 23 g carbs, 29 g fat, 31 g fiber";
    await e2eControls.setAiMode({ parseFood: "explicit-nutrition" });
    const input = await openFoodComposer(page);
    const parseRequestPromise = nextParseRequest(page);

    await input.fill(explicitDescription);
    await input.press("Enter");
    const parseBody = (await parseRequestPromise).postDataJSON() as ParseFoodRequestBody;
    expect(parseBody.text).toBe(explicitDescription);
    await expect(page.getByText("Added 1", { exact: true })).toBeVisible();

    await page.reload();
    await mealButton(page, parseBody.defaultMealType).click();
    const savedEntry = mealSection(page, parseBody.defaultMealType).getByRole("button", {
      name: /^E2E trail mix 913\s+kcal • P: 17\s+g • C: 23\s+g • F: 29\s+g • Fi: 31\s+g$/,
    });
    await expect(savedEntry).toBeVisible();
    await savedEntry.click();

    await expect(page.getByRole("dialog", { name: "E2E trail mix" })).toBeVisible();

    // Keep a stable content locator while switching editor modes.
    const editor = page.locator('[data-slot="dialog-content"]');
    const context = editor.locator('[data-slot="dialog-description"]');
    await expect(editor).toHaveCount(1);
    await expect(context).toContainText("913\u00a0kcal");
    await expect(context).toContainText("P 17\u00a0g");
    await expect(context).toContainText("C 23\u00a0g");
    await expect(context).toContainText("F 29\u00a0g");
    await expect(context).toContainText("Fi 31\u00a0g");
    await expect(editor.getByText("Current saved values", { exact: true })).toHaveCount(0);
    await expect(editor.getByText("Result", { exact: true })).toHaveCount(0);

    await editor.getByRole("button", { name: "Edit fields", exact: true }).click();
    await expect(editor.getByRole("heading", { name: "E2E trail mix", exact: true })).toBeVisible();
    await expect(editor.getByLabel("Name", { exact: true })).toHaveValue("E2E trail mix");
    await expect(editor.getByLabel("Portion", { exact: true })).toHaveValue("37 g");
    await expect(editor.getByLabel("Calories", { exact: true })).toHaveValue("913");

    await editor.getByRole("button", { name: "Nutrition details", exact: true }).click();
    await expect(editor.getByLabel("Protein", { exact: true })).toHaveValue("17");
    await expect(editor.getByLabel("Carbohydrates", { exact: true })).toHaveValue("23");
    await expect(editor.getByLabel("Fat", { exact: true })).toHaveValue("29");
    await expect(editor.getByLabel("Fiber", { exact: true })).toHaveValue("31");

    await editor.locator('[data-slot="dialog-close"]').click();
    await expect(editor).toBeHidden();
  });
});
