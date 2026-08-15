import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FoodEntryResponse } from "@contracts/food-log";
import { FoodEntryEditor } from "./FoodEntryEditor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const entry: FoodEntryResponse = {
  id: "11111111-1111-4111-8111-111111111111",
  day: "2026-08-15",
  mealType: "lunch",
  name: "Soup",
  calories: 220,
  protein: 12,
  carbs: 25,
  fats: 8,
  fiber: 4,
  portion: "350 ml",
  mealSlug: "soup",
  createdAt: "2026-08-15T12:00:00.000Z",
};

afterEach(cleanup);

describe("FoodEntryEditor", () => {
  it("leaves focus alone and keeps the schedule fields in compact columns", async () => {
    render(
      createElement(FoodEntryEditor, {
        entry,
        busy: false,
        onClose: vi.fn(),
        onSave: vi.fn(async () => true),
        onDelete: vi.fn(async () => true),
      }),
    );

    const name = screen.getByLabelText("entryEditor.name") as HTMLInputElement;
    const day = screen.getByLabelText("entryEditor.day") as HTMLInputElement;
    const meal = screen.getByRole("combobox", { name: "entryEditor.meal" });
    const scheduleFields = day.parentElement?.parentElement;

    await waitFor(() => expect(document.activeElement).not.toBe(name));
    expect(scheduleFields?.classList.contains("grid-cols-2")).toBe(true);
    expect(scheduleFields?.classList.contains("grid-cols-1")).toBe(false);
    expect(meal.className).toContain("data-[size=default]:h-11");
  });

  it("clamps the native date control to the shared input height on WebKit", () => {
    render(
      createElement(FoodEntryEditor, {
        entry,
        busy: false,
        onClose: vi.fn(),
        onSave: vi.fn(async () => true),
        onDelete: vi.fn(async () => true),
      }),
    );

    const day = screen.getByLabelText("entryEditor.day") as HTMLInputElement;

    expect(day.type).toBe("date");
    expect(day.classList.contains("inline-flex")).toBe(true);
    expect(day.classList.contains("flex")).toBe(false);
    expect(day.className).toContain("max-h-11");
    expect(day.className).toContain("appearance-none");
    expect(day.className).toContain("px-0");
    expect(day.className).toContain("py-0");
    expect(day.classList.contains("px-3")).toBe(false);
    expect(day.classList.contains("py-2")).toBe(false);
    expect(day.className).toContain("[&::-webkit-date-and-time-value]:h-[1.5em]");
    expect(day.className).toContain("[&::-webkit-date-and-time-value]:px-3");
    expect(day.className).toContain("[&::-webkit-date-and-time-value]:text-left");
  });

  it("opens prefilled and keeps invalid edits while showing field feedback", async () => {
    const onSave = vi.fn(async () => true);
    render(
      createElement(FoodEntryEditor, {
        entry,
        busy: false,
        onClose: vi.fn(),
        onSave,
        onDelete: vi.fn(async () => true),
      }),
    );

    const name = screen.getByLabelText("entryEditor.name") as HTMLInputElement;
    const calories = screen.getByLabelText("entryEditor.calories") as HTMLInputElement;
    expect(name.value).toBe("Soup");
    expect((screen.getByLabelText("entryEditor.portion") as HTMLInputElement).value).toBe("350 ml");
    expect((screen.getByLabelText("entryEditor.day") as HTMLInputElement).value).toBe("2026-08-15");

    expect(screen.queryByLabelText("entryEditor.protein")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.details" }));
    expect((screen.getByLabelText("entryEditor.protein") as HTMLInputElement).value).toBe("12");

    fireEvent.change(name, { target: { value: "   " } });
    fireEvent.change(calories, { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.save" }));

    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
    expect(onSave).not.toHaveBeenCalled();
    expect(name.value).toBe("   ");
    expect(calories.value).toBe("-5");
  });

  it("submits all persisted fields after a valid correction", async () => {
    const onSave = vi.fn(async () => true);
    const onClose = vi.fn();
    render(
      createElement(FoodEntryEditor, {
        entry,
        busy: false,
        onClose,
        onSave,
        onDelete: vi.fn(async () => true),
      }),
    );

    fireEvent.change(screen.getByLabelText("entryEditor.name"), {
      target: { value: "Tomato soup" },
    });
    fireEvent.change(screen.getByLabelText("entryEditor.day"), {
      target: { value: "2026-08-16" },
    });
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).toEqual(entry);
    expect(onSave.mock.calls[0]?.[1]).toMatchObject({
      name: "Tomato soup",
      day: "2026-08-16",
      mealType: "lunch",
      portion: "350 ml",
      calories: 220,
      protein: 12,
      carbs: 25,
      fats: 8,
      fiber: 4,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
