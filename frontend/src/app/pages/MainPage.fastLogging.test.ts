import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppTabChatProvider } from "../context/AppTabChatContext";
import MainPage from "./MainPage";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const emptyDay = {
  day: "2026-08-15",
  calorieGoal: 2_000,
  totalCalories: 0,
  meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
};

const { rootStore } = vi.hoisted(() => ({
  rootStore: {
    profile: {
      read: { profile: null, fetchState: "success", errorKey: "", load: vi.fn() },
    },
    foodLog: {
      dayRead: {
        day: "2026-08-15",
        data: {
          day: "2026-08-15",
          calorieGoal: 2_000,
          totalCalories: 0,
          meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
        } as typeof emptyDay | null,
        fetchState: "success",
        errorKey: "",
        loadDay: vi.fn(),
      },
      frequentWeekRead: { items: [], load: vi.fn() },
      historicalSuggestions: { items: [], fetchState: "initial", load: vi.fn(), clear: vi.fn() },
      entryCreate: { fetchState: "initial", errorKey: "", create: vi.fn() },
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
    dailyTip: { data: null, fetchState: "initial", errorKey: "", fetchTip: vi.fn() },
    aiParse: { data: null, fetchState: "initial", errorKey: "", parse: vi.fn() },
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
  useDailyTipAutoFetch: () => undefined,
}));
vi.mock("../components/CaloriePieChart", () => ({ CaloriePieChart: () => null }));
vi.mock("../components/DayMacrosLabels", () => ({ DayMacrosLabels: () => null }));
vi.mock("../components/FoodEntryEditor", () => ({ FoodEntryEditor: () => null }));
vi.mock("../components/MealSection", () => ({
  MealSection: ({ title, pendingFoods = [] }: {
    title: string;
    pendingFoods?: Array<{ id: string; label: string; phase: string }>;
  }) => createElement(
    "section",
    { "aria-label": title },
    pendingFoods.map((pending) =>
      createElement("div", { key: pending.id, "data-phase": pending.phase }, pending.label),
    ),
  ),
}));

function renderMainPage() {
  return render(createElement(AppTabChatProvider, null, createElement(MainPage)));
}

function openComposer() {
  fireEvent.click(screen.getByRole("button", { name: "main.logFoodPlaceholder" }));
  return screen.getByPlaceholderText("main.logFoodPlaceholder") as HTMLInputElement;
}

function suggestion(name: string, mealType: "lunch" | "dinner") {
  return {
    name,
    calories: 500,
    protein: 30,
    carbs: 45,
    fats: 18,
    fiber: 5,
    portion: "1 plate",
    day: "2026-08-15",
    mealType,
  };
}

function createdEntry(name: string, mealType: "lunch" | "dinner", index: number) {
  return {
    ...suggestion(name, mealType),
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    createdAt: `2026-08-15T12:00:0${index}.000Z`,
  };
}

beforeEach(() => {
  rootStore.foodLog.dayRead.data = emptyDay;
  rootStore.foodLog.entriesCreate.errorKey = "";
  rootStore.foodLog.entryDelete.errorKey = "";
  rootStore.aiParse.errorKey = "";
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("MainPage fast logging", () => {
  it("accepts consecutive Enter submissions, keeps focus, and shows pending target meals", async () => {
    const firstParse = deferred<{ data: { suggestions: ReturnType<typeof suggestion>[] } }>();
    const secondParse = deferred<{ data: { suggestions: ReturnType<typeof suggestion>[] } }>();
    const firstSave = deferred<{ entries: ReturnType<typeof createdEntry>[] }>();
    rootStore.aiParse.parse
      .mockReturnValueOnce(firstParse.promise)
      .mockReturnValueOnce(secondParse.promise);
    rootStore.foodLog.entriesCreate.create
      .mockReturnValueOnce(firstSave.promise)
      .mockResolvedValueOnce({ entries: [createdEntry("Soup", "lunch", 2)] });

    renderMainPage();
    const input = openComposer();
    fireEvent.change(input, { target: { value: "Steak 250g" } });
    fireEvent.submit(input.closest("form")!);
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: "Soup 400 ml" } });
    fireEvent.submit(input.closest("form")!);
    expect(rootStore.aiParse.parse).toHaveBeenCalledTimes(2);
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);

    await act(async () => firstParse.resolve({ data: { suggestions: [suggestion("Steak", "dinner")] } }));
    await waitFor(() => {
      const dinner = screen.getByRole("region", { name: "meals.dinner", hidden: true });
      expect(dinner.textContent).toContain("Steak");
      expect(dinner.querySelector("[data-phase='saving']")).not.toBeNull();
    });

    await act(async () => secondParse.resolve({ data: { suggestions: [suggestion("Soup", "lunch")] } }));
    await waitFor(() => expect(screen.getAllByText("Soup").length).toBeGreaterThan(0));
    await act(async () => firstSave.resolve({ entries: [createdEntry("Steak", "dinner", 1)] }));
    await waitFor(() => expect(screen.getAllByText("Steak").length).toBeGreaterThan(0));
  });

  it("preserves exact failed text and retries save without parsing it again", async () => {
    const explicitText = "  2 eggs, 140 kcal, 12g protein  ";
    rootStore.aiParse.parse
      .mockImplementationOnce(async () => {
        return { errorKey: "errors.network" };
      })
      .mockResolvedValueOnce({ data: { suggestions: [suggestion("2 eggs", "lunch")] } });
    rootStore.foodLog.entriesCreate.create
      .mockImplementationOnce(async () => {
        return { errorKey: "errors.network" };
      })
      .mockResolvedValueOnce({ entries: [createdEntry("2 eggs", "lunch", 3)] });

    renderMainPage();
    const input = openComposer();
    fireEvent.change(input, { target: { value: explicitText } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("errors.network"));
    expect(document.body.textContent).toContain(explicitText);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "main.retrySubmission" })));
    await waitFor(() => expect(rootStore.foodLog.entriesCreate.create).toHaveBeenCalledTimes(1));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "main.retrySubmission" })));

    await waitFor(() => expect(screen.getByText("2 eggs")).toBeTruthy());
    expect(rootStore.aiParse.parse).toHaveBeenCalledTimes(2);
    expect(rootStore.foodLog.entriesCreate.create).toHaveBeenCalledTimes(2);
    expect(rootStore.aiParse.parse.mock.calls[0]?.[0].text).toBe(explicitText);
    expect(rootStore.aiParse.parse.mock.calls[1]?.[0].text).toBe(explicitText);
  });
});
