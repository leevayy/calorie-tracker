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
    session: {
      user: { id: "11111111-1111-4111-8111-111111111111", email: "unit@example.invalid" },
    },
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
      historicalSuggestions: {
        query: "",
        items: [],
        fetchState: "initial",
        load: vi.fn(),
        clear: vi.fn(),
      },
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
    aiParse: { data: null, fetchState: "initial", errorKey: "", parse: vi.fn() },
  },
}));

vi.mock("mobx-react-lite", () => ({ observer: (component: unknown) => component }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      const count = Number(values?.count);
      if (key === "main.loggedFoods") {
        return `${count} ${count === 1 ? "food" : "foods"}`;
      }
      if (key === "main.loggingActivitySummary") {
        return `Logging activity · ${count} ${count === 1 ? "group" : "groups"} logged · ${String(values?.foods)}`;
      }
      if (key === "main.undoAddedGroup") {
        return `Undo added group: ${String(values?.foods)}`;
      }
      return key;
    },
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
  return screen.getByRole("combobox", { name: "main.logFoodPlaceholder" }) as HTMLInputElement;
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
  window.sessionStorage.clear();
  rootStore.aiParse.parse.mockReset();
  rootStore.foodLog.entriesCreate.create.mockReset();
  rootStore.foodLog.dayRead.data = emptyDay;
  rootStore.foodLog.historicalSuggestions.items = [];
  rootStore.foodLog.historicalSuggestions.query = "";
  rootStore.foodLog.historicalSuggestions.fetchState = "initial";
  rootStore.foodLog.entriesCreate.errorKey = "";
  rootStore.foodLog.entryDelete.errorKey = "";
  rootStore.aiParse.errorKey = "";
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("MainPage fast logging", () => {
  it("keeps a long success burst compact while every receipt remains reachable", async () => {
    rootStore.foodLog.historicalSuggestions.query = "Greek";
    rootStore.foodLog.historicalSuggestions.fetchState = "success";
    rootStore.foodLog.historicalSuggestions.items = [{
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
    }];
    for (let index = 1; index <= 12; index += 1) {
      rootStore.aiParse.parse.mockResolvedValueOnce({
        data: { suggestions: [suggestion(`Burst item ${index}`, "lunch")] },
      });
      rootStore.foodLog.entriesCreate.create.mockResolvedValueOnce({
        entries: [createdEntry(`Burst item ${index}`, "lunch", index)],
      });
    }

    renderMainPage();
    const input = openComposer();
    for (let index = 1; index <= 12; index += 1) {
      fireEvent.change(input, { target: { value: `Burst description ${index}` } });
      fireEvent.submit(input.closest("form")!);
      await waitFor(() => {
        expect(rootStore.foodLog.entriesCreate.create).toHaveBeenCalledTimes(index);
      });
    }

    fireEvent.change(input, { target: { value: "Greek" } });
    const suggestionList = screen.getByRole("listbox", { name: "main.historicalSuggestions" });
    const activity = screen.getByRole("button", {
      name: "Logging activity · 12 groups logged · 12 foods",
    });

    expect(activity.getAttribute("aria-expanded")).toBe("false");
    expect(
      suggestionList.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(screen.queryByText("main.addedReceipt")).toBeNull();

    fireEvent.click(activity);
    expect(activity.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByText("main.addedReceipt")).toHaveLength(12);
    expect(screen.getAllByRole("button", { name: "main.editAddedFood" })).toHaveLength(12);
    expect(screen.getAllByRole("button", { name: /^Undo added group:/ })).toHaveLength(12);
    expect(
      document.querySelector<HTMLElement>("[data-slot='collapsible-content']")?.className,
    ).toContain("max-h-64");
  });

  it("hides obsolete historical options as soon as the query changes", () => {
    rootStore.foodLog.historicalSuggestions.query = "Greek";
    rootStore.foodLog.historicalSuggestions.fetchState = "success";
    rootStore.foodLog.historicalSuggestions.items = [{
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
    }];

    renderMainPage();
    const input = openComposer();
    fireEvent.change(input, { target: { value: "Greek" } });
    expect(screen.getByRole("option", { name: /Greek yogurt/ })).toBeTruthy();

    fireEvent.change(input, { target: { value: "Apple" } });

    expect(screen.queryByRole("listbox", { name: "main.historicalSuggestions" })).toBeNull();
  });

  it("keeps one multi-food receipt operable with an explicit date after dashboard navigation", async () => {
    rootStore.aiParse.parse.mockResolvedValue({
      data: {
        suggestions: [suggestion("Oats", "lunch"), suggestion("Banana", "lunch")],
      },
    });
    rootStore.foodLog.entriesCreate.create.mockResolvedValue({
      entries: [createdEntry("Oats", "lunch", 13), createdEntry("Banana", "lunch", 14)],
    });

    renderMainPage();
    const input = openComposer();
    fireEvent.change(input, { target: { value: "Oats and banana" } });
    fireEvent.submit(input.closest("form")!);

    const activity = await screen.findByRole("button", {
      name: "Logging activity · 1 group logged · 2 foods",
    });
    expect(activity.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("button", { name: "main.editAddedFood" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Undo added group: Oats and Banana" })).toBeTruthy();
    expect(screen.getAllByText(/August 15, 2026.*meals\.lunch/)).toHaveLength(2);

    fireEvent.keyDown(document, { key: "Escape" });
    await screen.findByRole("button", { name: "main.logFoodPlaceholder" });
    // Vaul's exit animation does not run in jsdom, so its portal remains hidden
    // after closing even though the public dashboard state is interactive again.
    fireEvent.click(screen.getByRole("button", { name: "main.previousDayTo", hidden: true }));
    openComposer();

    expect(screen.getByRole("button", {
      name: "Logging activity · 1 group logged · 2 foods",
    }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByText(/August 15, 2026.*meals\.lunch/)).toHaveLength(2);
  });

  it("restores exact failed text for editing and cancels back to the existing draft", async () => {
    const failedText = "  mistyped oats & milk, 37 g  ";
    rootStore.aiParse.parse.mockResolvedValue({ errorKey: "errors.network" });

    renderMainPage();
    const input = openComposer();
    fireEvent.change(input, { target: { value: failedText } });
    fireEvent.submit(input.closest("form")!);
    await screen.findByRole("alert");

    fireEvent.change(input, { target: { value: "unrelated draft" } });
    fireEvent.click(screen.getByRole("button", { name: "main.editFailedSubmission" }));
    expect(input.value).toBe(failedText);
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: "repaired oats and milk" } });
    expect(screen.getByRole("button", { name: "main.retrySubmission" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "main.cancelFailedSubmissionEdit" }));

    expect(input.value).toBe("unrelated draft");
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("button", { name: "main.retrySubmission" })).toBeTruthy();
    expect(document.body.textContent).toContain(failedText);

    fireEvent.click(screen.getByRole("button", { name: "main.editFailedSubmission" }));
    fireEvent.change(input, { target: { value: "another repair" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.getByRole("combobox", { name: "main.logFoodPlaceholder" })).toBe(input);
    expect(input.value).toBe("unrelated draft");
    expect(document.activeElement).toBe(input);
  });

  it("supersedes a repaired failure with one new parse attempt and one active status", async () => {
    const originalText = "oats typo original";
    const repairedText = "oats with milk repaired";
    const repairedParse = deferred<{ data: { suggestions: ReturnType<typeof suggestion>[] } }>();
    rootStore.aiParse.parse
      .mockResolvedValueOnce({ errorKey: "errors.network" })
      .mockReturnValueOnce(repairedParse.promise);
    rootStore.foodLog.entriesCreate.create.mockResolvedValue({
      entries: [createdEntry("Repaired oats", "lunch", 9)],
    });

    renderMainPage();
    const input = openComposer();
    fireEvent.change(input, { target: { value: originalText } });
    fireEvent.submit(input.closest("form")!);
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "main.editFailedSubmission" }));
    fireEvent.change(input, { target: { value: repairedText } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(rootStore.aiParse.parse).toHaveBeenCalledTimes(2));
    expect(rootStore.aiParse.parse.mock.calls[1]?.[0].text).toBe(repairedText);
    expect(screen.queryByText(originalText, { exact: true })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByText(repairedText, { exact: true })).toHaveLength(2);

    await act(async () => repairedParse.resolve({
      data: { suggestions: [suggestion("Repaired oats", "lunch")] },
    }));
    await screen.findByText("main.addedReceipt");
    expect(screen.getByRole("button", {
      name: "Logging activity · 1 group logged · 1 food",
    })).toBeTruthy();
    expect(screen.queryByText(originalText, { exact: true })).toBeNull();
  });

  it("leaves edit mode and restores the prior draft when direct Retry is chosen", async () => {
    const retryParse = deferred<{ errorKey: string }>();
    rootStore.aiParse.parse
      .mockResolvedValueOnce({ errorKey: "errors.network" })
      .mockReturnValueOnce(retryParse.promise);

    renderMainPage();
    const input = openComposer();
    fireEvent.change(input, { target: { value: "failed oats" } });
    fireEvent.submit(input.closest("form")!);
    await screen.findByRole("alert");

    fireEvent.change(input, { target: { value: "keep this unrelated draft" } });
    fireEvent.click(screen.getByRole("button", { name: "main.editFailedSubmission" }));
    fireEvent.change(input, { target: { value: "unfinished repair" } });
    fireEvent.click(screen.getByRole("button", { name: "main.retrySubmission" }));

    await waitFor(() => expect(rootStore.aiParse.parse).toHaveBeenCalledTimes(2));
    expect(input.value).toBe("keep this unrelated draft");
    expect(screen.queryByRole("button", { name: "main.cancelFailedSubmissionEdit" })).toBeNull();
    expect(document.activeElement).toBe(input);

    await act(async () => retryParse.resolve({ errorKey: "errors.network" }));
    await screen.findByRole("alert");
  });

  it("restores a save-stage failure after remount and retries without parsing again", async () => {
    const failedText = "persistent save-stage oats";
    rootStore.aiParse.parse.mockResolvedValue({
      data: { suggestions: [suggestion("Persistent oats", "lunch")] },
    });
    rootStore.foodLog.entriesCreate.create
      .mockResolvedValueOnce({ errorKey: "errors.network" })
      .mockResolvedValueOnce({ entries: [createdEntry("Persistent oats", "lunch", 8)] });

    const firstView = renderMainPage();
    const input = openComposer();
    fireEvent.change(input, { target: { value: failedText } });
    fireEvent.submit(input.closest("form")!);
    await screen.findByRole("alert");
    expect(rootStore.aiParse.parse).toHaveBeenCalledTimes(1);

    firstView.unmount();
    cleanup();
    renderMainPage();
    openComposer();
    expect(await screen.findByText(failedText, { exact: true })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "main.retrySubmission" }));

    await screen.findByText("main.addedReceipt");
    expect(rootStore.aiParse.parse).toHaveBeenCalledTimes(1);
    expect(rootStore.foodLog.entriesCreate.create).toHaveBeenCalledTimes(2);
  });

  it("keeps a failed submission durable while its retry is in flight", async () => {
    const failedText = "retry survives an interrupted request";
    const retryParse = deferred<{ data: { suggestions: ReturnType<typeof suggestion>[] } }>();
    rootStore.aiParse.parse
      .mockResolvedValueOnce({ errorKey: "errors.network" })
      .mockReturnValueOnce(retryParse.promise);

    const firstView = renderMainPage();
    const input = openComposer();
    fireEvent.change(input, { target: { value: failedText } });
    fireEvent.submit(input.closest("form")!);
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "main.retrySubmission" }));
    await waitFor(() => expect(rootStore.aiParse.parse).toHaveBeenCalledTimes(2));
    firstView.unmount();
    cleanup();

    renderMainPage();
    openComposer();
    expect(await screen.findByText(failedText, { exact: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "main.retrySubmission" })).toBeTruthy();
  });

  it("supersedes the edited failure when a historical option is selected", async () => {
    const failedText = "replace failed yogurt description";
    rootStore.aiParse.parse.mockResolvedValue({ errorKey: "errors.network" });
    rootStore.foodLog.historicalSuggestions.query = failedText;
    rootStore.foodLog.historicalSuggestions.fetchState = "success";
    rootStore.foodLog.historicalSuggestions.items = [{
      name: "Stored yogurt",
      portion: "170 g",
      calories: 150,
      protein: 15,
      carbs: 12,
      fats: 4,
      fiber: 1,
      mealSlug: "stored-yogurt",
      usageCount: 2,
      lastUsedDay: "2026-08-14",
    }];
    rootStore.foodLog.entriesCreate.create.mockResolvedValue({
      entries: [createdEntry("Stored yogurt", "lunch", 18)],
    });

    renderMainPage();
    const input = openComposer();
    fireEvent.change(input, { target: { value: failedText } });
    fireEvent.submit(input.closest("form")!);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "main.editFailedSubmission" }));

    fireEvent.click(screen.getByRole("option", { name: /Stored yogurt/ }));

    await screen.findByText("main.addedReceipt");
    expect(screen.queryByText(failedText, { exact: true })).toBeNull();
    expect(screen.queryByText("main.editingFailedSubmission", { exact: true })).toBeNull();
    expect(screen.queryByRole("button", { name: "main.retrySubmission" })).toBeNull();
    expect(input.value).toBe("");
  });

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
    const activity = await screen.findByRole("button", {
      name: "Logging activity · 2 groups logged · 2 foods",
    });
    expect(activity.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(activity);
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
