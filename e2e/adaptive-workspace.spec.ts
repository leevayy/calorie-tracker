import type { Page, Request } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { openAdaptiveFoodComposer, usesDesktopWorkspace } from "./support/adaptiveComposer";

type ParseFoodRequestBody = {
  defaultMealType: "breakfast" | "lunch" | "dinner" | "snack";
};

function nextParseRequest(page: Page): Promise<Request> {
  return page.waitForRequest((request) =>
    request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/ai/parse-food",
  );
}

function mealSection(page: Page, name: string) {
  return page.getByRole("region", { name, exact: true });
}

test.describe("Approved adaptive food journal", () => {
  test("preserves the logging session while crossing the compact and continuous-ledger workspace", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 767, height: 900 });
    const dateNavigation = page.getByRole("group", { name: "Log date", exact: true });
    await dateNavigation.getByRole("button", { name: /Previous day/ }).click();
    const selectedDate = await dateNavigation.getByRole("button").nth(1).getAttribute("aria-label");

    const input = await openAdaptiveFoodComposer(page);
    await page.getByRole("combobox", { name: "Meal", exact: true }).click();
    await page.getByRole("option", { name: "Dinner", exact: true }).click();
    await input.fill("resize-safe tofu and rice");

    await page.waitForTimeout(350);
    const resizeRequests: string[] = [];
    const recordRequest = (request: Request) => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/api/v1/")) resizeRequests.push(pathname);
    };
    page.on("request", recordRequest);

    await page.setViewportSize({ width: 768, height: 900 });
    const desktopInput = page.getByRole("combobox", { name: "Log food", exact: true });
    await expect(page.locator("#food-log-sheet")).toHaveCount(0);
    await expect(desktopInput).toBeVisible();
    await expect(desktopInput).toHaveValue("resize-safe tofu and rice");
    await expect(dateNavigation.getByRole("button").nth(1)).toHaveAttribute(
      "aria-label",
      selectedDate ?? "",
    );

    await page.setViewportSize({ width: 767, height: 900 });
    await expect(page.locator("#food-log-sheet")).toBeVisible();
    await expect(input).toHaveValue("resize-safe tofu and rice");
    await expect(page.getByRole("combobox", { name: "Meal", exact: true })).toHaveText("Dinner");
    page.off("request", recordRequest);
    expect(resizeRequests).toEqual([]);
  });

  test("renders one desktop header row with the visible composer and continuous ledger", async ({
    authenticatedPage: page,
  }) => {
    if (!usesDesktopWorkspace(page)) {
      await expect(page.getByTestId("desktop-journal-header")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Log food", exact: true })).toBeVisible();
      return;
    }

    const header = page.getByTestId("desktop-journal-header");
    await expect(header).toBeVisible();
    await expect(header).toContainText(/\d[\d,.]* \/ 2[,.]?000\s*kcal/);
    for (const nutrient of ["P", "C", "F", "Fi"]) {
      await expect(header.getByText(new RegExp(`^${nutrient}\\s`))).toBeVisible();
    }
    await expect(header.getByRole("group", { name: "Log date" })).toBeVisible();
    const geometry = await header.evaluate((element) => {
      const children = [...element.children].map((child) => child.getBoundingClientRect());
      const headerRect = element.getBoundingClientRect();
      return {
        oneRow: Math.max(...children.map((rect) => rect.top)) <
          Math.min(...children.map((rect) => rect.bottom)),
        contained: children.every(
          (rect) => rect.left >= headerRect.left - 1 && rect.right <= headerRect.right + 1,
        ),
        noDocumentOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
      };
    });
    expect(geometry).toEqual({ oneRow: true, contained: true, noDocumentOverflow: true });

    for (const [width, height] of [[768, 900], [900, 1024], [1280, 720], [1440, 900]] as const) {
      await test.step(`${width}x${height} one-row header`, async () => {
        await page.setViewportSize({ width, height });
        await expect(header).toBeVisible();
        const fit = await header.evaluate((element) => {
          const children = [...element.children].map((child) => child.getBoundingClientRect());
          const bounds = element.getBoundingClientRect();
          return {
            oneRow: children.every((rect) => Math.abs(rect.top - children[0]!.top) < 2),
            contained: children.every((rect) => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1),
            noDocumentOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
          };
        });
        expect(fit).toEqual({ oneRow: true, contained: true, noDocumentOverflow: true });
      });
    }

    await expect(page.getByRole("combobox", { name: "Log food", exact: true })).toBeVisible();
    await expect(page.locator("#food-log-sheet")).toHaveCount(0);
    for (const meal of ["Breakfast", "Lunch", "Dinner", "Snack"]) {
      const section = mealSection(page, meal);
      await expect(section.getByRole("table", { name: `${meal} foods` })).toBeVisible();
      await expect(section.getByRole("button", { name: "Add", exact: true })).toBeVisible();
    }
    await mealSection(page, "Lunch").getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Log food", exact: true }))
      .toHaveValue("For lunch I ate ");
    await expect(page.getByRole("combobox", { name: "Log food", exact: true })).toBeFocused();
  });

  test("keeps concurrent pending descriptions ordered and supports the newest group's snackbar Undo", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    if (!usesDesktopWorkspace(page)) {
      await expect(page.getByTestId("desktop-journal-header")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Log food", exact: true })).toBeVisible();
      return;
    }
    await e2eControls.setAiMode({ parseFood: "delay", delayMs: 1_500 });
    const input = await openAdaptiveFoodComposer(page);

    const firstRequest = nextParseRequest(page);
    await input.fill("first pending oatmeal");
    await input.press("Enter");
    const targetMeal = ((await firstRequest).postDataJSON() as ParseFoodRequestBody).defaultMealType;

    const secondRequest = nextParseRequest(page);
    await input.fill("second pending oatmeal");
    await input.press("Enter");
    await secondRequest;

    const mealName = {
      breakfast: "Breakfast",
      lunch: "Lunch",
      dinner: "Dinner",
      snack: "Snack",
    }[targetMeal];
    const rows = mealSection(page, mealName).getByRole("table").getByRole("row");
    await expect(rows.filter({ hasText: "first pending oatmeal" })).toBeVisible();
    await expect(rows.filter({ hasText: "second pending oatmeal" })).toBeVisible();
    const pendingOrder = await rows.allTextContents();
    expect(pendingOrder.findIndex((text) => text.includes("first pending oatmeal")))
      .toBeLessThan(pendingOrder.findIndex((text) => text.includes("second pending oatmeal")));

    const newestSnackbar = page.getByRole("status").filter({ hasText: "Added 1 food" });
    await expect(newestSnackbar).toBeVisible();
    await newestSnackbar.hover();
    await page.waitForTimeout(4_100);
    await expect(newestSnackbar).toBeVisible();
    await newestSnackbar.getByRole("button", { name: /Undo added group:/ }).click();
    await expect(newestSnackbar).toBeHidden();

    const savedRows = mealSection(page, mealName).getByRole("row", { name: /E2E oatmeal/ });
    await expect(savedRows).toHaveCount(1);
  });

  test("keeps a failed description in its desktop ledger row with recovery actions", async ({
    authenticatedPage: page,
    e2eControls,
  }) => {
    if (!usesDesktopWorkspace(page)) {
      await expect(page.getByTestId("desktop-journal-header")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Log food", exact: true })).toBeVisible();
      return;
    }
    await e2eControls.setAiMode({ parseFood: "success" });
    await e2eControls.failNextBatchSave();
    const input = await openAdaptiveFoodComposer(page);
    const exactDescription = "failed desktop oats & milk, 37 g";
    const parseRequest = nextParseRequest(page);
    await input.fill(exactDescription);
    await input.press("Enter");
    const targetMeal = ((await parseRequest).postDataJSON() as ParseFoodRequestBody).defaultMealType;
    const mealName = {
      breakfast: "Breakfast",
      lunch: "Lunch",
      dinner: "Dinner",
      snack: "Snack",
    }[targetMeal];

    const failedRow = mealSection(page, mealName).getByRole("row", {
      name: new RegExp(exactDescription),
    });
    await expect(failedRow).toBeVisible();
    await expect(failedRow.getByRole("alert")).toContainText("Request failed");
    await expect(failedRow.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await failedRow.getByRole("button", { name: "Edit description", exact: true }).click();
    await expect(input).toHaveValue(exactDescription);
    await failedRow.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(failedRow).toHaveCount(0);
  });

  test("preserves the compact mobile composer sheet and meal presentation", async ({
    authenticatedPage: page,
  }) => {
    if (usesDesktopWorkspace(page)) {
      await expect(page.getByTestId("desktop-journal-header")).toBeVisible();
      await expect(page.getByRole("button", { name: "Log food", exact: true })).toHaveCount(0);
      return;
    }

    await expect(page.getByTestId("desktop-journal-header")).toHaveCount(0);
    const trigger = page.getByRole("button", { name: "Log food", exact: true });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const sheet = page.locator("#food-log-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("combobox", { name: "Log food", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: /^Breakfast\b/ })).toBeVisible();
  });
});
