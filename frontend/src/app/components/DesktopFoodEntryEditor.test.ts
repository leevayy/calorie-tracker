import type { FoodEntryResponse } from "@contracts/food-log";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { DesktopFoodEntryEditor } from "./DesktopFoodEntryEditor";

const { apiCorrectFoodEntry } = vi.hoisted(() => ({ apiCorrectFoodEntry: vi.fn() }));
vi.mock("@/api/aiFood", () => ({ apiCorrectFoodEntry }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

const entry: FoodEntryResponse = {
  id: "11111111-1111-4111-8111-111111111111",
  day: "2026-08-17",
  mealType: "lunch",
  name: "Soup",
  portion: "350 ml",
  calories: 220,
  protein: 12,
  carbs: 25,
  fats: 8,
  fiber: 4,
  createdAt: "2026-08-17T12:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  apiCorrectFoodEntry.mockReset();
});

function renderEditor(overrides: Record<string, unknown> = {}) {
  const props = {
    entry,
    busy: false,
    onClose: vi.fn(),
    onSave: vi.fn(async () => true),
    onDelete: vi.fn(async () => true),
    ...overrides,
  };
  render(createElement(DesktopFoodEntryEditor, props));
  return props;
}

describe("DesktopFoodEntryEditor", () => {
  it("shows AI, manual nutrition, date, and meal controls together and saves manual edits", async () => {
    const { onSave, onClose } = renderEditor();

    expect(screen.getByLabelText("entryEditor.instruction")).toBeTruthy();
    expect(screen.getByLabelText("entryEditor.name")).toBeTruthy();
    expect(screen.getByLabelText("entryEditor.protein")).toBeTruthy();
    expect(screen.getByLabelText("entryEditor.day")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "entryEditor.meal" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "entryEditor.save" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("entryEditor.name"), { target: { value: "Tomato soup" } });
    fireEvent.change(screen.getByLabelText("entryEditor.calories"), { target: { value: "240" } });
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(entry, expect.objectContaining({ name: "Tomato soup", calories: 240 })));
    expect(onClose).toHaveBeenCalledOnce();
    expect(apiCorrectFoodEntry).not.toHaveBeenCalled();
  });

  it("uses the original saved entry for AI and ignores simultaneous manual edits", async () => {
    const corrected = { name: "Large soup", portion: "700 ml", calories: 440, protein: 24, carbs: 50, fats: 16, fiber: 8, day: entry.day, mealType: entry.mealType };
    apiCorrectFoodEntry.mockResolvedValueOnce({ draft: corrected });
    const { onSave } = renderEditor();

    fireEvent.change(screen.getByLabelText("entryEditor.calories"), { target: { value: "350" } });
    fireEvent.change(screen.getByLabelText("entryEditor.instruction"), { target: { value: "double it" } });
    expect(screen.getByRole("button", { name: "entryEditor.sendAndSave" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.sendAndSave" }));

    await waitFor(() => expect(apiCorrectFoodEntry).toHaveBeenCalledWith(entry.id, {
      instruction: "double it",
      preferredLanguage: "en",
    }));
    expect(onSave).toHaveBeenCalledWith(entry, corrected);
    expect(onSave).not.toHaveBeenCalledWith(entry, expect.objectContaining({ calories: 350 }));
  });

  it("retains all inputs on AI failure and can clear AI to save the manual draft", async () => {
    apiCorrectFoodEntry.mockRejectedValueOnce(new ApiError("errors.correction_unactionable", 422));
    const { onSave } = renderEditor();
    const instruction = screen.getByLabelText("entryEditor.instruction") as HTMLInputElement;
    const calories = screen.getByLabelText("entryEditor.calories") as HTMLInputElement;

    fireEvent.change(calories, { target: { value: "350" } });
    fireEvent.change(instruction, { target: { value: "make it more accurate" } });
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.sendAndSave" }));

    expect((await screen.findByRole("alert")).textContent).toBe("errors.correction_unactionable");
    expect(instruction.value).toBe("make it more accurate");
    expect(calories.value).toBe("350");

    fireEvent.click(screen.getByRole("button", { name: "entryEditor.clearInstruction" }));
    expect(instruction.value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(entry, expect.objectContaining({ calories: 350 })));
  });
});
