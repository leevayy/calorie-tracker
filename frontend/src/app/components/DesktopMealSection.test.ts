import type { FoodEntryResponse } from "@contracts/food-log";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createElement, type ComponentProps } from "react";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/locales/en.json";
import { DesktopLedgerHeader, DesktopMealSection } from "./DesktopMealSection";

const food: FoodEntryResponse = {
  id: "00000000-0000-4000-8000-000000000001",
  day: "2026-08-17",
  mealType: "lunch",
  name: "Chicken and rice",
  portion: "1 bowl",
  calories: 540,
  protein: 42,
  carbs: 58,
  fats: 14,
  fiber: 6,
  createdAt: "2026-08-17T10:00:00.000Z",
};

afterEach(cleanup);

async function renderSection(overrides: Partial<ComponentProps<typeof DesktopMealSection>> = {}) {
  const i18n = i18next.createInstance();
  await i18n.init({ resources: { en: { translation: en } }, lng: "en" });
  const props = {
    title: "Lunch",
    foods: [food],
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    ...overrides,
  };
  render(createElement(I18nextProvider, { i18n }, createElement(DesktopMealSection, props)));
  return props;
}

describe("DesktopMealSection", () => {
  it("starts expanded and renders a single aligned nutrition ledger", async () => {
    await renderSection();

    expect(screen.getByRole("button", { name: /Lunch/ }).getAttribute("aria-expanded")).toBe("true");
    const table = screen.getByRole("table", { name: "Lunch foods" });
    expect(within(table).queryByRole("columnheader")).toBeNull();
    expect(within(table).getByText("Chicken and rice")).toBeTruthy();
    expect(within(table).getByText("1 bowl")).toBeTruthy();
    expect(within(table).getByText(/540\s*kcal/)).toBeTruthy();
    expect(within(table).getByText(/42\s*g/)).toBeTruthy();
    expect(within(table).getByText(/6\s*g/)).toBeTruthy();
  });

  it("renders the ledger column labels once as a standalone header", async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ resources: { en: { translation: en } }, lng: "en" });
    render(createElement(I18nextProvider, { i18n }, createElement(DesktopLedgerHeader)));
    for (const label of ["Food / portion", "kcal", "P", "C", "F", "Fi"]) {
      expect(screen.getByText(label, { exact: true })).toBeTruthy();
    }
  });

  it("keeps Add independent from collapse and opens a food for editing", async () => {
    const { onAdd, onEdit } = await renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledOnce();
    expect(screen.getByRole("table", { name: "Lunch foods" })).toBeTruthy();

    fireEvent.click(screen.getByRole("row", { name: /Chicken and rice/ }));
    expect(onEdit).toHaveBeenCalledWith(food);

    fireEvent.click(screen.getByRole("button", { name: /Lunch/ }));
    expect(screen.queryByRole("table", { name: "Lunch foods" })).toBeNull();
  });

  it("places pending submissions before saved foods in submission order", async () => {
    await renderSection({
      pendingFoods: [
        { id: "first", label: "Soup and bread", phase: "parsing" },
        { id: "second", label: "Coffee", phase: "saving" },
      ],
    });

    const rows = within(screen.getByRole("table", { name: "Lunch foods" })).getAllByRole("row");
    expect(rows[0].textContent).toContain("Soup and bread");
    expect(rows[1].textContent).toContain("Coffee");
    expect(rows[2].textContent).toContain("Chicken and rice");
  });

  it("keeps the exact failed description inline with retry, edit, and clear actions", async () => {
    const onRetry = vi.fn();
    const onEdit = vi.fn();
    const onClear = vi.fn();
    const exactDescription = "  oats & milk, 37 g  ";
    await renderSection({
      pendingFoods: [{
        id: "failed",
        label: exactDescription,
        phase: "failed",
        errorLabel: "Network error",
        onRetry,
        onEdit,
        onClear,
      }],
    });

    const failedRow = within(screen.getByRole("table", { name: "Lunch foods" }))
      .getByRole("row", { name: /oats & milk/ });
    expect(failedRow.textContent?.startsWith(exactDescription)).toBe(true);
    expect(within(failedRow).getByRole("alert").textContent).toBe("Network error");

    fireEvent.click(within(failedRow).getByRole("button", { name: "Retry" }));
    fireEvent.click(within(failedRow).getByRole("button", { name: "Edit description" }));
    fireEvent.click(within(failedRow).getByRole("button", { name: "Clear" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("inserts the selected editor immediately after its exact saved row", async () => {
    await renderSection({
      renderEditor: (candidate) => candidate.id === food.id
        ? createElement("form", { "aria-label": "Edit Chicken and rice" }, "editor")
        : null,
    });

    const foodRow = screen.getAllByRole("row", { name: /Chicken and rice/ })
      .find((row) => row.tagName === "BUTTON")!;
    const editor = screen.getByRole("form", { name: "Edit Chicken and rice" });
    expect(foodRow.getAttribute("aria-expanded")).toBe("true");
    expect(foodRow.nextElementSibling?.contains(editor)).toBe(true);
  });
});
