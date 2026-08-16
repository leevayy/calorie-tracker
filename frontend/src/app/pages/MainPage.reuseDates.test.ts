import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppTabChatProvider } from "../context/AppTabChatContext";
import MainPage from "./MainPage";

const historicalFood = {
  name: "Greek yogurt",
  portion: "200 g",
  calories: 180,
  protein: 20,
  carbs: 12,
  fats: 5,
  fiber: 1,
  mealSlug: "greek-yogurt",
  usageCount: 4,
  lastUsedDay: "2026-08-12",
};

const { rootStore } = vi.hoisted(() => ({
  rootStore: {
    profile: { read: { profile: null, fetchState: "success", errorKey: "", load: vi.fn() } },
    foodLog: {
      dayRead: {
        day: "2026-08-15",
        data: {
          day: "2026-08-15",
          calorieGoal: 2_000,
          totalCalories: 0,
          meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
        },
        fetchState: "success",
        errorKey: "",
        loadDay: vi.fn(),
      },
      frequentWeekRead: { items: [], load: vi.fn() },
      historicalSuggestions: {
        items: [{
          name: "Greek yogurt",
          portion: "200 g",
          calories: 180,
          protein: 20,
          carbs: 12,
          fats: 5,
          fiber: 1,
          mealSlug: "greek-yogurt",
          usageCount: 4,
          lastUsedDay: "2026-08-12",
        }],
        fetchState: "success",
        load: vi.fn(),
        clear: vi.fn(),
      },
      entryCreate: { fetchState: "initial", errorKey: "", create: vi.fn() },
      entriesCreate: { fetchState: "initial", errorKey: "", create: vi.fn() },
      entryUpdate: { fetchState: "initial", errorKey: "", clearError: vi.fn(), update: vi.fn() },
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
    aiParse: { data: null, fetchState: "initial", errorKey: "", parse: vi.fn() },
  },
}));

vi.mock("mobx-react-lite", () => ({ observer: (component: unknown) => component }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", resolvedLanguage: "en-US" },
  }),
}));
vi.mock("@/stores/StoreContext", () => ({ useRootStore: () => rootStore }));
vi.mock("../hooks/useRequireAuth", () => ({ useRequireAuth: () => undefined }));
vi.mock("./main/mainPageHooks", () => ({
  useBehavioralToday: () => "2026-08-15",
}));
vi.mock("../components/CaloriePieChart", () => ({ CaloriePieChart: () => null }));
vi.mock("../components/DayMacrosLabels", () => ({ DayMacrosLabels: () => null }));
vi.mock("../components/FoodEntryEditor", () => ({ FoodEntryEditor: () => null }));
vi.mock("../components/MealSection", () => ({ MealSection: () => null }));

function renderMainPage() {
  return render(createElement(AppTabChatProvider, null, createElement(MainPage)));
}

function openComposer() {
  fireEvent.click(screen.getByRole("button", { name: "main.logFoodPlaceholder" }));
  return screen.getByRole("textbox", { name: "main.logFoodPlaceholder" }) as HTMLInputElement;
}

beforeEach(() => {
  rootStore.foodLog.historicalSuggestions.items = [historicalFood];
  rootStore.foodLog.entriesCreate.create.mockResolvedValue({ entries: [] });
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("MainPage reuse and dates", () => {
  it("navigates across days while retaining a direct return-to-today action", async () => {
    renderMainPage();
    rootStore.foodLog.dayRead.loadDay.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "main.previousDay" }));
    await waitFor(() => expect(rootStore.foodLog.dayRead.loadDay).toHaveBeenCalledWith("2026-08-14"));
    expect(screen.getByText(/August 14, 2026/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "main.returnToToday" }));
    await waitFor(() => expect(rootStore.foodLog.dayRead.loadDay).toHaveBeenCalledWith("2026-08-15"));
  });

  it("keeps the selected day authoritative when an AI response names another day", async () => {
    rootStore.aiParse.parse.mockResolvedValue({
      data: {
        suggestions: [{
          name: "Soup",
          portion: "1 bowl",
          calories: 220,
          protein: 8,
          carbs: 30,
          fats: 7,
          fiber: 4,
          day: "2026-08-15",
          mealType: "lunch",
        }],
      },
    });
    renderMainPage();
    fireEvent.click(screen.getByRole("button", { name: "main.previousDay" }));
    const input = openComposer();
    fireEvent.change(input, { target: { value: "Soup" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(rootStore.foodLog.entriesCreate.create).toHaveBeenCalled());
    expect(rootStore.foodLog.entriesCreate.create.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ name: "Soup", day: "2026-08-14", mealType: "lunch" }),
    ]);
  });

  it("logs a stored configuration on the selected day without invoking AI", async () => {
    renderMainPage();
    fireEvent.click(screen.getByRole("button", { name: "main.previousDay" }));
    const input = openComposer();
    fireEvent.change(input, { target: { value: "Greek" } });
    fireEvent.click(screen.getByRole("option", { name: /Greek yogurt/ }));

    await waitFor(() => expect(rootStore.foodLog.entriesCreate.create).toHaveBeenCalled());
    expect(rootStore.aiParse.parse).not.toHaveBeenCalled();
    expect(rootStore.foodLog.entriesCreate.create.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        day: "2026-08-14",
        name: "Greek yogurt",
        portion: "200 g",
        calories: 180,
        protein: 20,
        carbs: 12,
        fats: 5,
        fiber: 1,
        mealSlug: "greek-yogurt",
      }),
    ]);
  });
});
