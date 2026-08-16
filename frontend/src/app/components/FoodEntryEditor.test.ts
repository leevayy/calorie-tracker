import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FoodEntryResponse } from "@contracts/food-log";
import { ApiError } from "@/api/errors";
import { FoodEntryEditor } from "./FoodEntryEditor";

const { apiCorrectFoodEntry } = vi.hoisted(() => ({
  apiCorrectFoodEntry: vi.fn(),
}));

vi.mock("@/api/aiFood", () => ({ apiCorrectFoodEntry }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  apiCorrectFoodEntry.mockReset();
});

function openSchedule() {
  fireEvent.click(
    screen.getByRole("button", { name: "entryEditor.day · entryEditor.meal" }),
  );
}

describe("FoodEntryEditor", () => {
  it("uses a mobile sheet, leaves focus alone, and progressively reveals the schedule", async () => {
    render(
      createElement(FoodEntryEditor, {
        entry,
        busy: false,
        onClose: vi.fn(),
        onSave: vi.fn(async () => true),
        onDelete: vi.fn(async () => true),
      }),
    );

    const dialog = screen.getByRole("dialog");
    const instruction = screen.getByLabelText("entryEditor.instruction") as HTMLInputElement;
    const scheduleTrigger = screen.getByRole("button", {
      name: "entryEditor.day · entryEditor.meal",
    });

    expect(dialog.className).toContain("bottom-0");
    expect(dialog.className).toContain("env(safe-area-inset-top,0px)");
    expect(dialog.className).toContain("sm:top-[50%]");
    expect(screen.getByRole("heading", { name: "Soup" })).toBeTruthy();
    expect(
      dialog.querySelector('[data-slot="dialog-description"]')?.textContent,
    ).toContain("220\u00a0history.calShort");
    expect(instruction.parentElement?.className).toContain("space-y-2");
    expect(scheduleTrigger.getAttribute("aria-label")).toBe(
      "entryEditor.day · entryEditor.meal",
    );
    const scheduleDescriptionId = scheduleTrigger.getAttribute("aria-describedby");
    expect(scheduleDescriptionId).toBe("food-entry-schedule-summary");
    expect(document.getElementById(scheduleDescriptionId ?? "")?.textContent).toBe(
      "August 15, 2026 · meals.lunch",
    );
    expect(screen.queryByLabelText("entryEditor.day")).toBeNull();
    openSchedule();

    const day = screen.getByLabelText("entryEditor.day") as HTMLInputElement;
    const meal = screen.getByRole("combobox", { name: "entryEditor.meal" });
    const scheduleFields = day.parentElement?.parentElement;

    await waitFor(() => expect(document.activeElement).not.toBe(instruction));
    expect(scheduleFields?.classList.contains("grid-cols-1")).toBe(true);
    expect(scheduleFields?.className).toContain("min-[360px]:grid-cols-2");
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

    openSchedule();
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

    expect(screen.queryByLabelText("entryEditor.name")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.editFields" }));
    const name = screen.getByLabelText("entryEditor.name") as HTMLInputElement;
    const calories = screen.getByLabelText("entryEditor.calories") as HTMLInputElement;
    expect(name.value).toBe("Soup");
    expect((screen.getByLabelText("entryEditor.portion") as HTMLInputElement).value).toBe("350 ml");
    openSchedule();
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

    fireEvent.click(screen.getByRole("button", { name: "entryEditor.editFields" }));
    fireEvent.change(screen.getByLabelText("entryEditor.name"), {
      target: { value: "Tomato soup" },
    });
    openSchedule();
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

  it("opens AI-first, previews a complete scaled draft, and saves only after review", async () => {
    const onSave = vi.fn(async () => true);
    const onClose = vi.fn();
    apiCorrectFoodEntry.mockResolvedValueOnce({
      draft: {
        name: "Soup",
        portion: "350 ml",
        calories: 440,
        protein: 24,
        carbs: 50,
        fats: 16,
        fiber: 8,
        day: "2026-08-15",
        mealType: "lunch",
      },
    });
    render(
      createElement(FoodEntryEditor, {
        entry,
        busy: false,
        onClose,
        onSave,
        onDelete: vi.fn(async () => true),
      }),
    );

    expect(screen.getByRole("heading", { name: "Soup" })).toBeTruthy();
    expect(screen.queryByText("entryEditor.aiMode")).toBeNull();
    expect(screen.queryByText("entryEditor.currentResult")).toBeNull();
    openSchedule();
    expect(screen.getByLabelText("entryEditor.day")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "entryEditor.meal" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("entryEditor.day"), {
      target: { value: "2026-08-16" },
    });
    const instruction = screen.getByLabelText("entryEditor.instruction") as HTMLInputElement;
    fireEvent.change(instruction, { target: { value: "double the calories" } });
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.previewCorrection" }));

    await waitFor(() => expect(apiCorrectFoodEntry).toHaveBeenCalledWith(entry.id, {
      instruction: "double the calories",
      preferredLanguage: "en",
    }));
    expect(await screen.findByText((_, element) =>
      element?.textContent === "350 ml · 440\u00a0history.calShort",
    )).toBeTruthy();
    expect(screen.getByText("entryEditor.proposedResult")).toBeTruthy();
    expect((screen.getByLabelText("entryEditor.day") as HTMLInputElement).value).toBe(
      "2026-08-16",
    );
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "entryEditor.save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(entry, {
      name: "Soup",
      portion: "350 ml",
      calories: 440,
      protein: 24,
      carbs: 50,
      fats: 16,
      fiber: 8,
      day: "2026-08-16",
      mealType: "lunch",
    }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clears a persisted portion when the correction draft omits it", async () => {
    const onSave = vi.fn(async () => true);
    apiCorrectFoodEntry.mockResolvedValueOnce({
      draft: {
        name: "Soup",
        calories: 220,
        protein: 12,
        carbs: 25,
        fats: 8,
        fiber: 4,
        day: "2026-08-15",
        mealType: "lunch",
      },
    });
    render(
      createElement(FoodEntryEditor, {
        entry,
        busy: false,
        onClose: vi.fn(),
        onSave,
        onDelete: vi.fn(async () => true),
      }),
    );

    fireEvent.change(screen.getByLabelText("entryEditor.instruction"), {
      target: { value: "remove the portion" },
    });
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.previewCorrection" }));

    expect(await screen.findByText((_, element) =>
      element?.textContent === "entryEditor.noPortion · 220\u00a0history.calShort",
    )).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "entryEditor.editFields" }));
    expect((screen.getByLabelText("entryEditor.portion") as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[1]).toEqual({
      name: "Soup",
      calories: 220,
      protein: 12,
      carbs: 25,
      fats: 8,
      fiber: 4,
      day: "2026-08-15",
      mealType: "lunch",
    });
  });

  it("shows placeholders for invalid shared-draft numbers after a proposal", async () => {
    apiCorrectFoodEntry.mockResolvedValueOnce({
      draft: {
        name: "Soup",
        portion: "350 ml",
        calories: 440,
        protein: 24,
        carbs: 50,
        fats: 16,
        fiber: 8,
        day: "2026-08-15",
        mealType: "lunch",
      },
    });
    render(
      createElement(FoodEntryEditor, {
        entry,
        busy: false,
        onClose: vi.fn(),
        onSave: vi.fn(async () => true),
        onDelete: vi.fn(async () => true),
      }),
    );

    fireEvent.change(screen.getByLabelText("entryEditor.instruction"), {
      target: { value: "adjust the nutrition" },
    });
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.previewCorrection" }));
    await screen.findByText("entryEditor.proposedResult");

    fireEvent.click(screen.getByRole("button", { name: "entryEditor.editFields" }));
    fireEvent.change(screen.getByLabelText("entryEditor.calories"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.details" }));
    fireEvent.change(screen.getByLabelText("entryEditor.protein"), {
      target: { value: "-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.backToAi" }));

    const proposal = screen.getByText("entryEditor.proposedResult").parentElement;
    expect(proposal?.textContent).toContain("350 ml · —");
    expect(proposal?.textContent).toContain("macros.proteinLetter —");
    expect(proposal?.textContent).not.toContain("0\u00a0history.calShort");

    fireEvent.click(screen.getByRole("button", { name: "entryEditor.editFields" }));
    expect((screen.getByLabelText("entryEditor.calories") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("entryEditor.protein") as HTMLInputElement).value).toBe("-1");
  });

  it("reveals hidden invalid nutrition and schedule fields before saving", async () => {
    const onSave = vi.fn(async () => true);
    apiCorrectFoodEntry.mockResolvedValueOnce({
      draft: {
        name: "Soup",
        portion: "350 ml",
        calories: 220,
        protein: -1,
        carbs: 25,
        fats: 8,
        fiber: 4,
        day: "2026-08-15",
        mealType: "lunch",
      },
    });
    render(
      createElement(FoodEntryEditor, {
        entry,
        busy: false,
        onClose: vi.fn(),
        onSave,
        onDelete: vi.fn(async () => true),
      }),
    );

    fireEvent.change(screen.getByLabelText("entryEditor.instruction"), {
      target: { value: "adjust the nutrition" },
    });
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.previewCorrection" }));
    await screen.findByText("entryEditor.proposedResult");
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.save" }));

    const protein = await screen.findByLabelText("entryEditor.protein");
    expect(protein.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("entryEditor.validation.nonnegative")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(protein, { target: { value: "12" } });
    openSchedule();
    fireEvent.change(screen.getByLabelText("entryEditor.day"), {
      target: { value: "not-a-date" },
    });
    openSchedule();
    expect(screen.queryByLabelText("entryEditor.day")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.save" }));

    const day = await screen.findByLabelText("entryEditor.day");
    expect(day.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("entryEditor.validation.date")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("preserves the instruction and shared draft on AI failure and mode switches", async () => {
    apiCorrectFoodEntry.mockRejectedValueOnce(
      new ApiError("errors.correction_unactionable", 422),
    );
    render(
      createElement(FoodEntryEditor, {
        entry,
        busy: false,
        onClose: vi.fn(),
        onSave: vi.fn(async () => true),
        onDelete: vi.fn(async () => true),
      }),
    );

    const instruction = screen.getByLabelText("entryEditor.instruction") as HTMLInputElement;
    fireEvent.change(instruction, { target: { value: "make it better somehow" } });
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.previewCorrection" }));

    expect((await screen.findByRole("alert")).textContent).toBe("errors.correction_unactionable");
    expect(instruction.value).toBe("make it better somehow");
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.editFields" }));
    const name = screen.getByLabelText("entryEditor.name") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Clear soup" } });
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.backToAi" }));

    expect((screen.getByLabelText("entryEditor.instruction") as HTMLInputElement).value).toBe(
      "make it better somehow",
    );
    expect(screen.queryByText("entryEditor.currentResult")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "entryEditor.editFields" }));
    expect((screen.getByLabelText("entryEditor.name") as HTMLInputElement).value).toBe(
      "Clear soup",
    );
  });
});
