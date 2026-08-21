import type { Locator, Page } from "@playwright/test";
import {
  behavioralIsoDay,
  expect,
  isolatedTestUser,
  loginThroughSetup,
  test,
} from "./support/fixtures";

function savedFood(page: Page, name: string): Locator {
  return page.getByRole("button", { name: new RegExp(`^${name}\\b`) });
}

function inlineDisplayDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

test.describe("Whole-number nutrition display", () => {
  test("rounds fractional nutrition values across Today and History", async ({
    page,
    e2eControls,
  }) => {
    const day = behavioralIsoDay();
    const user = isolatedTestUser({
      entries: [
        {
          day,
          mealType: "breakfast",
          name: "Fractional oats",
          portion: "test portion",
          calories: 1_668.7,
          protein: 12.4,
          carbs: 12.5,
          fats: 0.49,
          fiber: 99.9,
        },
      ],
    });
    await e2eControls.reset([user]);
    await loginThroughSetup(page, user);

    const breakfast = page.getByRole("region", { name: "Breakfast", exact: true });
    const desktopRow = breakfast.getByRole("row", { name: /^Fractional oats\b/ });
    const mobileMeal = page.getByRole("button", { name: /^Breakfast\b/ });

    if (await desktopRow.count()) {
      await expect(desktopRow).toContainText("1669 kcal");
      await expect(desktopRow).toContainText("12 g");
      await expect(desktopRow).toContainText("13 g");
      await expect(desktopRow).toContainText("0 g");
      await expect(desktopRow).toContainText("100 g");
      await expect(desktopRow).not.toContainText(/[.,]\d/);
    } else {
      await expect(mobileMeal).toContainText("1669 kcal");
      await expect(mobileMeal).toContainText("P: 12\u00a0g");
      await expect(mobileMeal).toContainText("C: 13\u00a0g");
      await expect(mobileMeal).toContainText("F: 0\u00a0g");
      await expect(mobileMeal).toContainText("Fi: 100\u00a0g");
      await mobileMeal.click();
      await expect(savedFood(page, "Fractional oats")).toContainText("1669 kcal");
      await expect(savedFood(page, "Fractional oats")).not.toContainText(/[.,]\d/);
    }

    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page).toHaveURL(/\/history$/);
    const historyDay = page.getByRole("button", {
      name: `Open log: ${inlineDisplayDay(day)}`,
      exact: true,
    });
    await expect(historyDay).toContainText("1669 / 2000 kcal");
    await expect(historyDay).toContainText("P 12\u00a0g");
    await expect(historyDay).toContainText("C 13\u00a0g");
    await expect(historyDay).toContainText("F 0\u00a0g");
    await expect(historyDay).toContainText("Fi 100\u00a0g");
    await expect(historyDay).not.toContainText(/[.,]\d/);
  });
});
