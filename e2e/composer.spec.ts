import type { Page, Request } from "@playwright/test";
import { expect, test } from "./support/fixtures";

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
  const input = page.getByPlaceholder(/Log food/);
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

function mealButton(page: Page, mealType: MealType, calories?: number) {
  const caloriePattern = calories === undefined ? ".*" : `.*${calories} cal`;
  return page.getByRole("button", {
    name: new RegExp(`^${MEAL_LABELS[mealType]}\\b${caloriePattern}`),
  });
}

function mealSection(page: Page, mealType: MealType) {
  return mealButton(page, mealType).locator("..");
}

test.describe("Keyboard-fast food composer", () => {
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

    await expect(page.getByText("Added 1", { exact: true })).toHaveCount(2);
    await expect(input).toBeFocused();

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
    await page.keyboard.press("Escape");

    await expect(page.getByRole("button", { name: /Log food/ })).toBeVisible();
    await expect(page.getByText("pending target-meal oatmeal", { exact: true })).toBeVisible();
    await expect(page.getByText("Understanding…", { exact: true })).toBeVisible();

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
    await expect(page.getByText(parseFailureText, { exact: true })).toBeVisible();
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
    await expect(page.getByText(saveFailureText, { exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("Request failed");
    await expect(input).toHaveValue("");

    await e2eControls.setAiMode({ parseFood: "failure" });
    let retryParseRequests = 0;
    const countParseRequests = (request: Request) => {
      if (new URL(request.url()).pathname === "/api/v1/ai/parse-food") retryParseRequests += 1;
    };
    page.on("request", countParseRequests);
    await page.getByRole("button", { name: "Retry", exact: true }).click();
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
      name: /^E2E trail mix 913 cal .*P: 17g .*C: 23g .*F: 29g .*Fi: 31g$/,
    });
    await expect(savedEntry).toBeVisible();
    await savedEntry.click();

    const editor = page.getByRole("dialog", { name: "Correct food" });
    await expect(editor).toContainText("37 g · 913 cal");
    await expect(editor).toContainText("P 17 · C 23 · F 29 · Fi 31");
  });
});
