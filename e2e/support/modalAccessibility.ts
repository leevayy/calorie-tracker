import type { Page } from "@playwright/test";
import { expect } from "./fixtures";

/** Prove that modal background controls still exist visually but are absent from the accessibility tree. */
export async function expectAppBackgroundExcludedFromAccessibilityTree(
  page: Page,
): Promise<void> {
  const previousDayDomControl = page.locator('button[aria-label^="Previous day,"]');
  const historyDomControl = page.locator('button[aria-label="History"]');

  await expect(previousDayDomControl).toHaveCount(1);
  await expect(historyDomControl).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Previous day,/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "History", exact: true })).toHaveCount(0);
}
