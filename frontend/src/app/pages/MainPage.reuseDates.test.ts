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
        query: "Greek",
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
    t: (key: string) => ({
      "macros.proteinLetter": "P",
      "macros.carbsLetter": "C",
      "macros.fatsLetter": "F",
      "macros.fiberLetter": "Fi",
    })[key] ?? key,
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
  return screen.getByRole("combobox", { name: "main.logFoodPlaceholder" }) as HTMLInputElement;
}

beforeEach(() => {
  rootStore.aiParse.parse.mockReset();
  rootStore.foodLog.entriesCreate.create.mockReset();
  rootStore.foodLog.historicalSuggestions.items = [historicalFood];
  rootStore.foodLog.historicalSuggestions.query = "Greek";
  rootStore.foodLog.historicalSuggestions.fetchState = "success";
  rootStore.foodLog.entriesCreate.create.mockResolvedValue({ entries: [] });
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("MainPage reuse and dates", () => {
  it("mounts only the desktop journal surface at the desktop breakpoint", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as MediaQueryList));

    renderMainPage();

    expect(screen.getByTestId("desktop-journal-header")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "main.previousDayTo" })).toHaveLength(1);
    expect(screen.getByRole("combobox", { name: "main.logFoodPlaceholder" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "main.logFoodPlaceholder" })).toBeNull();
  });

  it("shows the shared meal target with a clock-derived default", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 15, 8, 30));
    const view = renderMainPage();

    openComposer();
    const mealTarget = screen.getByRole("combobox", { name: "entryEditor.meal" });
    expect(mealTarget.textContent).toContain("meals.breakfast");

    view.unmount();
    vi.useRealTimers();
  });

  it("refreshes an untouched clock-derived target on reopen but preserves an override", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 15, 8, 30));
    renderMainPage();

    openComposer();
    let mealTarget = screen.getByRole("combobox", { name: "entryEditor.meal" });
    expect(mealTarget.textContent).toContain("meals.breakfast");
    fireEvent.keyDown(document, { key: "Escape" });

    vi.setSystemTime(new Date(2026, 7, 15, 18, 30));
    openComposer();
    mealTarget = screen.getByRole("combobox", { name: "entryEditor.meal" });
    expect(mealTarget.textContent).toContain("meals.dinner");
    fireEvent.click(mealTarget);
    fireEvent.click(screen.getByRole("option", { name: "meals.snack" }));
    fireEvent.keyDown(document, { key: "Escape" });

    vi.setSystemTime(new Date(2026, 7, 15, 12, 30));
    openComposer();
    expect(screen.getByRole("combobox", { name: "entryEditor.meal" }).textContent).toContain(
      "meals.snack",
    );
  });

  it("uses a changed meal target and the selected dashboard day for AI logging", async () => {
    rootStore.aiParse.parse.mockResolvedValue({
      data: {
        suggestions: [{
          name: "Late snack",
          portion: "1 bowl",
          calories: 240,
          protein: 9,
          carbs: 32,
          fats: 8,
          fiber: 5,
          day: "2026-08-15",
          mealType: "snack",
        }],
      },
    });

    renderMainPage();
    fireEvent.click(screen.getByRole("button", { name: "main.previousDayTo" }));
    const input = openComposer();
    const mealTarget = screen.getByRole("combobox", { name: "entryEditor.meal" });
    fireEvent.click(mealTarget);
    fireEvent.click(screen.getByRole("option", { name: "meals.snack" }));
    fireEvent.change(input, { target: { value: "Late snack" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(rootStore.foodLog.entriesCreate.create).toHaveBeenCalled());
    expect(rootStore.aiParse.parse.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ defaultLogDay: "2026-08-14", defaultMealType: "snack" }),
    );
    expect(rootStore.foodLog.entriesCreate.create.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ day: "2026-08-14", mealType: "snack", name: "Late snack" }),
    ]);
  });

  it("lets explicit AI meal metadata override the selected default target", async () => {
    rootStore.aiParse.parse.mockResolvedValue({
      data: {
        suggestions: [{
          name: "Dinner soup",
          portion: "1 bowl",
          calories: 220,
          protein: 8,
          carbs: 30,
          fats: 7,
          fiber: 4,
          day: "2026-08-15",
          mealType: "dinner",
        }],
      },
    });

    renderMainPage();
    const input = openComposer();
    const mealTarget = screen.getByRole("combobox", { name: "entryEditor.meal" });
    fireEvent.click(mealTarget);
    fireEvent.click(screen.getByRole("option", { name: "meals.breakfast" }));
    fireEvent.change(input, { target: { value: "Soup for dinner" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(rootStore.foodLog.entriesCreate.create).toHaveBeenCalled());
    expect(rootStore.aiParse.parse.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ defaultMealType: "breakfast" }),
    );
    expect(rootStore.foodLog.entriesCreate.create.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ mealType: "dinner", name: "Dinner soup" }),
    ]);
  });

  it("keeps one changed target across consecutive submissions", async () => {
    rootStore.aiParse.parse
      .mockResolvedValueOnce({
        data: {
          suggestions: [{
            name: "First snack",
            portion: "1 serving",
            calories: 180,
            protein: 6,
            carbs: 24,
            fats: 7,
            fiber: 3,
            day: "2026-08-15",
            mealType: "snack",
          }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          suggestions: [{
            name: "Second snack",
            portion: "1 serving",
            calories: 210,
            protein: 8,
            carbs: 28,
            fats: 8,
            fiber: 4,
            day: "2026-08-15",
            mealType: "snack",
          }],
        },
      });

    renderMainPage();
    const input = openComposer();
    const mealTarget = screen.getByRole("combobox", { name: "entryEditor.meal" });
    fireEvent.click(mealTarget);
    fireEvent.click(screen.getByRole("option", { name: "meals.snack" }));

    fireEvent.change(input, { target: { value: "First snack" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(rootStore.foodLog.entriesCreate.create).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: "Second snack" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(rootStore.foodLog.entriesCreate.create).toHaveBeenCalledTimes(2));
    expect(rootStore.aiParse.parse.mock.calls.map(([request]) => request.defaultMealType)).toEqual([
      "snack",
      "snack",
    ]);
    expect(rootStore.foodLog.entriesCreate.create.mock.calls.map(([entries]) => entries[0]?.mealType)).toEqual([
      "snack",
      "snack",
    ]);
  });

  it("gives both composer send controls a stable accessible name", () => {
    renderMainPage();
    expect(screen.getByRole("button", { name: "main.sendFood" })).toBeTruthy();

    openComposer();
    expect(screen.getByRole("button", { name: "main.sendFood" })).toBeTruthy();
  });

  it("shows macros that distinguish otherwise identical historical suggestions", () => {
    rootStore.foodLog.historicalSuggestions.items = [
      historicalFood,
      {
        ...historicalFood,
        protein: 12,
        carbs: 24,
        fats: 8,
        fiber: 3,
        lastUsedDay: "2026-08-11",
      },
    ];

    renderMainPage();
    const input = openComposer();
    fireEvent.change(input, { target: { value: "Greek" } });

    const options = screen.getAllByRole("option", { name: /Greek yogurt/ });
    expect(options).toHaveLength(2);
    expect(options[0]?.textContent).toMatch(/P 20\s*g.*C 12\s*g.*F 5\s*g.*Fi 1\s*g/);
    expect(options[1]?.textContent).toMatch(/P 12\s*g.*C 24\s*g.*F 8\s*g.*Fi 3\s*g/);
  });

  it("moves an active suggestion with arrows and logs it with Enter without leaving the input", async () => {
    const secondSuggestion = {
      ...historicalFood,
      name: "Greek yogurt large",
      portion: "300 g",
      calories: 260,
      usageCount: 2,
    };
    rootStore.foodLog.historicalSuggestions.items = [historicalFood, secondSuggestion];

    renderMainPage();
    const input = openComposer();
    fireEvent.change(input, { target: { value: "Greek" } });
    const options = screen.getAllByRole("option");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0]?.id);
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[1]?.id);
    expect(options[1]?.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0]?.id);
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(rootStore.foodLog.entriesCreate.create).toHaveBeenCalled());
    expect(rootStore.aiParse.parse).not.toHaveBeenCalled();
    expect(rootStore.foodLog.entriesCreate.create.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ name: "Greek yogurt", calories: 180 }),
    ]);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("");
  });

  it("keeps pointer accessibility state current and dismisses suggestions with Escape", () => {
    rootStore.foodLog.historicalSuggestions.items = [
      historicalFood,
      { ...historicalFood, name: "Greek yogurt large", portion: "300 g" },
    ];

    renderMainPage();
    const input = openComposer();
    fireEvent.change(input, { target: { value: "Greek" } });
    const list = screen.getByRole("listbox");
    const options = screen.getAllByRole("option");

    fireEvent.pointerMove(options[1]!);
    expect(options[1]?.getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[1]?.id);

    fireEvent.pointerLeave(list);
    expect(options[1]?.getAttribute("aria-selected")).toBe("false");
    expect(input.getAttribute("aria-activedescendant")).toBeNull();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input.value).toBe("Greek");
    expect(document.activeElement).toBe(input);
  });

  it("clears the active descendant when a suggestion response replaces the options", async () => {
    rootStore.foodLog.historicalSuggestions.items = [historicalFood];
    const view = renderMainPage();
    const input = openComposer();
    fireEvent.change(input, { target: { value: "Greek" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).not.toBeNull();

    rootStore.foodLog.historicalSuggestions.items = [{
      ...historicalFood,
      name: "Greek yogurt replacement",
      calories: 240,
    }];
    view.rerender(createElement(AppTabChatProvider, null, createElement(MainPage)));

    await waitFor(() => expect(input.getAttribute("aria-activedescendant")).toBeNull());
    expect(screen.getByRole("option").getAttribute("aria-selected")).toBe("false");
  });

  it("navigates across days while retaining a direct return-to-today action", async () => {
    renderMainPage();
    rootStore.foodLog.dayRead.loadDay.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "main.previousDayTo" }));
    await waitFor(() => expect(rootStore.foodLog.dayRead.loadDay).toHaveBeenCalledWith("2026-08-14"));
    expect(screen.getByText(/August 14, 2026/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "main.returnToToday" }));
    await waitFor(() => expect(rootStore.foodLog.dayRead.loadDay).toHaveBeenCalledWith("2026-08-15"));
  });

  it("integrates the shared navigator's direct date control", async () => {
    renderMainPage();
    rootStore.foodLog.dayRead.loadDay.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "main.chooseDate" }));
    const directDate = screen.getByLabelText("entryEditor.day") as HTMLInputElement;
    fireEvent.change(directDate, { target: { value: "2026-08-03" } });

    await waitFor(() => expect(rootStore.foodLog.dayRead.loadDay).toHaveBeenCalledWith("2026-08-03"));
    expect(screen.getByRole("button", { name: "main.chooseDate" }).textContent).toMatch(
      /August 3, 2026/,
    );
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
    fireEvent.click(screen.getByRole("button", { name: "main.previousDayTo" }));
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
    fireEvent.click(screen.getByRole("button", { name: "main.previousDayTo" }));
    const input = openComposer();
    const mealTarget = screen.getByRole("combobox", { name: "entryEditor.meal" });
    fireEvent.click(mealTarget);
    fireEvent.click(screen.getByRole("option", { name: "meals.dinner" }));
    await waitFor(() => expect(mealTarget.textContent).toContain("meals.dinner"));
    input.focus();
    fireEvent.change(input, { target: { value: "Greek" } });
    fireEvent.click(screen.getByRole("option", { name: /Greek yogurt/ }));

    await waitFor(() => expect(rootStore.foodLog.entriesCreate.create).toHaveBeenCalled());
    expect(document.activeElement).toBe(input);
    expect(rootStore.aiParse.parse).not.toHaveBeenCalled();
    expect(rootStore.foodLog.entriesCreate.create.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        day: "2026-08-14",
        mealType: "dinner",
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
