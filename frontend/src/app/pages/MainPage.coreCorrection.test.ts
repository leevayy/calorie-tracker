import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppTabChatProvider } from "../context/AppTabChatContext";
import MainPage from "./MainPage";

const foodEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  day: "2026-08-15",
  mealType: "breakfast" as const,
  name: "Oats",
  calories: 100,
  protein: 5,
  carbs: 15,
  fats: 2,
  fiber: 3,
  portion: "1 bowl",
  createdAt: "2026-08-15T08:00:00.000Z",
};

const { rootStore } = vi.hoisted(() => ({
  rootStore: {
    profile: {
      read: {
        profile: null as null | Record<string, unknown>,
        fetchState: "success",
        errorKey: "",
        load: vi.fn(),
      },
    },
    foodLog: {
      dayRead: {
        day: "2026-08-15",
        data: null as null | Record<string, unknown>,
        fetchState: "success",
        errorKey: "",
        loadDay: vi.fn(),
      },
      frequentWeekRead: { items: [], load: vi.fn() },
      historicalSuggestions: { items: [], fetchState: "initial", load: vi.fn(), clear: vi.fn() },
      entriesCreate: {
        fetchState: "initial",
        errorKey: "",
        isLoading: false,
        create: vi.fn(),
      },
      entryUpdate: {
        fetchState: "initial",
        errorKey: "",
        clearError: vi.fn(),
        update: vi.fn(),
      },
      entryDelete: {
        fetchState: "initial",
        errorKey: "",
        isLoading: false,
        clearError: vi.fn(),
        remove: vi.fn(),
        removeMany: vi.fn(),
        restore: vi.fn(),
      },
    },
    aiParse: {
      data: null as null | Record<string, unknown>,
      fetchState: "initial",
      errorKey: "",
      parse: vi.fn(),
    },
  },
}));

vi.mock("mobx-react-lite", () => ({ observer: (component: unknown) => component }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", resolvedLanguage: "en" },
  }),
}));
vi.mock("@/stores/StoreContext", () => ({ useRootStore: () => rootStore }));
vi.mock("../hooks/useRequireAuth", () => ({ useRequireAuth: () => undefined }));
vi.mock("./main/mainPageHooks", () => ({
  useBehavioralToday: () => "2026-08-15",
}));
vi.mock("../components/CaloriePieChart", () => ({ CaloriePieChart: () => null }));
vi.mock("../components/DayMacrosLabels", () => ({ DayMacrosLabels: () => null }));
vi.mock("../components/MealSection", () => ({
  MealSection: ({ foods, onEdit }: { foods: typeof foodEntry[]; onEdit: (entry: typeof foodEntry) => void }) =>
    foods[0]
      ? createElement("button", { type: "button", onClick: () => onEdit(foods[0]) }, "open-entry")
      : null,
}));
vi.mock("../components/FoodEntryEditor", () => ({
  FoodEntryEditor: ({
    entry,
    onClose,
    onDelete,
  }: {
    entry: typeof foodEntry | null;
    onClose: () => void;
    onDelete: (entry: typeof foodEntry) => Promise<boolean>;
  }) =>
    entry
      ? createElement(
          "div",
          null,
          createElement(
            "button",
            {
              type: "button",
              onClick: async () => {
                if (await onDelete(entry)) onClose();
              },
            },
            "delete-editor-entry",
          ),
          createElement("button", { type: "button", onClick: onClose }, "close-editor"),
        )
      : null,
}));

function renderMainPage() {
  return render(createElement(AppTabChatProvider, null, createElement(MainPage)));
}

beforeEach(() => {
  rootStore.foodLog.dayRead.data = null;
  rootStore.foodLog.entriesCreate.fetchState = "initial";
  rootStore.foodLog.entriesCreate.errorKey = "";
  rootStore.foodLog.entriesCreate.isLoading = false;
  rootStore.foodLog.entryUpdate.fetchState = "initial";
  rootStore.foodLog.entryDelete.fetchState = "initial";
  rootStore.foodLog.entryDelete.errorKey = "";
  rootStore.foodLog.entryDelete.isLoading = false;
  rootStore.aiParse.fetchState = "initial";
  rootStore.aiParse.data = null;
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("MainPage core corrections", () => {
  it("automatically saves every recognized food and offers one grouped undo", async () => {
    const suggestions = Array.from({ length: 4 }, (_, index) => ({
      name: `Food ${index + 1}`,
      calories: 100 + index,
      protein: 10,
      carbs: 12,
      fats: 4,
      fiber: 2,
      portion: "1 serving",
      day: "2026-08-15",
      mealType: "lunch" as const,
    }));
    rootStore.aiParse.parse.mockImplementation(async () => {
      rootStore.aiParse.data = { suggestions };
      rootStore.aiParse.fetchState = "success";
      return { data: { suggestions } };
    });
    const created = suggestions.map((food, index) => ({
      ...food,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      createdAt: `2026-08-15T12:00:0${index}.000Z`,
    }));
    rootStore.foodLog.entriesCreate.create.mockResolvedValue({ entries: created });
    rootStore.foodLog.entryDelete.removeMany.mockResolvedValue(created);

    renderMainPage();
    fireEvent.click(screen.getByRole("button", { name: "main.logFoodPlaceholder" }));
    const input = screen.getByRole("combobox", { name: "main.logFoodPlaceholder" });
    fireEvent.change(input, { target: { value: "four foods" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(rootStore.foodLog.entriesCreate.create).toHaveBeenCalled());
    expect(rootStore.foodLog.entriesCreate.create.mock.calls[0]?.[0]).toHaveLength(4);
    expect(screen.getByText("Food 4")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "main.logRecognizedGroup" })).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "main.editAddedFood" })[0]!);
    expect(rootStore.foodLog.entryUpdate.clearError).toHaveBeenCalled();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "main.undoAddedGroup" })));
    expect(rootStore.foodLog.entryDelete.removeMany).toHaveBeenCalledWith(created);
    await waitFor(() => expect(screen.queryByText("Food 4")).toBeNull());
  });

  it("presents Undo after deletion and restores the exact entry", async () => {
    rootStore.foodLog.dayRead.data = {
      day: "2026-08-15",
      calorieGoal: 2_000,
      totalCalories: foodEntry.calories,
      meals: { breakfast: [foodEntry], lunch: [], dinner: [], snack: [] },
    };
    rootStore.foodLog.entryDelete.remove.mockResolvedValue(foodEntry);
    rootStore.foodLog.entryDelete.restore.mockResolvedValue(foodEntry);

    renderMainPage();
    fireEvent.click(screen.getByRole("button", { name: "open-entry" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "delete-editor-entry" })));

    expect(screen.getByText("entryEditor.undoMessage")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "entryEditor.undo" })));

    expect(rootStore.foodLog.entryDelete.restore).toHaveBeenCalledWith(foodEntry.id);
    await waitFor(() => expect(screen.queryByText("entryEditor.undoMessage")).toBeNull());
  });
});
