import { createElement, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScheduleInputValue } from "./ScheduleInputs";
import { MealInput, ScheduleInputs } from "./ScheduleInputs";

const { translations } = vi.hoisted(() => ({
  translations: new Map<string, string>(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => translations.get(key) ?? key }),
}));

afterEach(() => {
  cleanup();
  translations.clear();
});

function ScheduleHarness() {
  const [value, setValue] = useState<ScheduleInputValue>({
    day: "2026-08-15",
    mealType: "breakfast",
  });
  return createElement(ScheduleInputs, {
    value,
    onChange: setValue,
  });
}

describe("ScheduleInputs", () => {
  it("exposes one controlled date-and-meal interface with the shared labels", () => {
    render(createElement(ScheduleHarness));

    const date = screen.getByLabelText("entryEditor.day") as HTMLInputElement;
    const meal = screen.getByRole("combobox", { name: "entryEditor.meal" });

    expect(date.value).toBe("2026-08-15");
    expect(meal.textContent).toContain("meals.breakfast");

    fireEvent.change(date, { target: { value: "2026-08-16" } });
    expect(date.value).toBe("2026-08-16");

    fireEvent.click(meal);
    fireEvent.click(screen.getByRole("option", { name: "meals.dinner" }));
    expect(meal.textContent).toContain("meals.dinner");
  });

  it("lets a meal-only caller control a translated selection without clipping it", () => {
    const longMeal = "Очень длинное локализованное название приёма пищи";
    translations.set("meals.dinner", longMeal);

    function MealHarness() {
      const [value, setValue] = useState<ScheduleInputValue["mealType"]>("dinner");
      return createElement(MealInput, { value, onChange: setValue });
    }

    render(createElement(MealHarness));
    const meal = screen.getByRole("combobox", { name: "entryEditor.meal" });

    expect(meal.textContent).toContain(longMeal);
    expect(meal.className).toContain("whitespace-normal");
    expect(meal.className).not.toContain("whitespace-nowrap");
    expect(meal.className).not.toContain("line-clamp-1");

    fireEvent.click(meal);
    fireEvent.click(screen.getByRole("option", { name: "meals.snack" }));
    expect(meal.textContent).toContain("meals.snack");
  });

  it("presents required, disabled, and field-error states consistently", () => {
    render(
      createElement(ScheduleInputs, {
        value: { day: "", mealType: "breakfast" },
        onChange: vi.fn(),
        disabled: true,
        errors: {
          day: "entryEditor.validation.date",
          mealType: "entryEditor.validation.required",
        },
      }),
    );

    const date = screen.getByLabelText("entryEditor.day") as HTMLInputElement;
    const meal = screen.getByRole("combobox", { name: "entryEditor.meal" });

    expect(date.required).toBe(true);
    expect(date.disabled).toBe(true);
    expect(date.getAttribute("aria-invalid")).toBe("true");
    expect((meal as HTMLButtonElement).disabled).toBe(true);
    expect(meal.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("entryEditor.validation.date").getAttribute("role")).toBe("alert");
    expect(
      screen.getByText("entryEditor.validation.required").getAttribute("role"),
    ).toBe("alert");
  });
});
