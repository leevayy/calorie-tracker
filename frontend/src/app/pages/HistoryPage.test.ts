import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { makeAutoObservable, runInAction } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FoodEntryResponse, UpdateFoodEntryBody } from "@contracts/food-log";
import { localIsoDate } from "@/utils/date";
import HistoryPage from "./HistoryPage";

const entry: FoodEntryResponse = {
  id: "11111111-1111-4111-8111-111111111111",
  day: "2026-08-14",
  mealType: "breakfast",
  name: "Oats",
  calories: 100,
  protein: 5,
  carbs: 15,
  fats: 2,
  fiber: 3,
  portion: "1 bowl",
  mealSlug: "oats",
  createdAt: "2026-08-14T08:00:00.000Z",
};

const dayLog = {
  day: "2026-08-14",
  calorieGoal: 2_000,
  totalCalories: 100,
  meals: { breakfast: [entry], lunch: [], dinner: [], snack: [] },
};

const copiedEntry: FoodEntryResponse = {
  ...entry,
  id: "22222222-2222-4222-8222-222222222222",
  day: "2026-08-15",
  mealType: "lunch",
  name: "Copied oats",
};

const { apiGetDayLog, rootStore } = vi.hoisted(() => ({
  apiGetDayLog: vi.fn(),
  rootStore: {
    history: {
      data: {
        from: "2026-08-09",
        to: "2026-08-15",
        weeklyAverageCalories: 100,
        days: [
          {
            date: "2026-08-14",
            calories: 100,
            goal: 2_000,
            protein: 5,
            carbs: 15,
            fats: 2,
            fiber: 3,
          },
        ],
      },
      fetchState: "success",
      errorKey: "",
      loadRange: vi.fn(),
    },
    foodLog: {
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
        restore: vi.fn(),
      },
      mealDuplicate: {
        fetchState: "initial",
        errorKey: "",
        duplicate: vi.fn(),
      },
    },
  },
}));

makeAutoObservable(rootStore.foodLog.entryUpdate, {
  clearError: false,
  update: false,
});
makeAutoObservable(rootStore.foodLog.mealDuplicate, {
  duplicate: false,
});

vi.mock("@/api/foodLog", () => ({ apiGetDayLog }));
vi.mock("@/stores/StoreContext", () => ({ useRootStore: () => rootStore }));
vi.mock("../hooks/useRequireAuth", () => ({ useRequireAuth: () => undefined }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && "goal" in options
        ? `${key}:${String(options.goal)}`
        : options && "meal" in options
          ? `${key}:${String(options.meal)}`
          : key,
    i18n: { language: "en" },
  }),
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: unknown }) =>
    createElement("div", null, children),
  LineChart: ({ children }: { children: unknown }) => createElement("div", null, children),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));
vi.mock("../components/MealSection", () => ({
  MealSection: ({
    title,
    foods,
    onEdit,
  }: {
    title: string;
    foods: FoodEntryResponse[];
    onEdit: (food: FoodEntryResponse) => void;
  }) =>
    createElement(
      "section",
      null,
      createElement("h4", null, title),
      foods.map((food) =>
        createElement(
          "button",
          { key: food.id, type: "button", onClick: () => onEdit(food) },
          food.name,
        ),
      ),
    ),
}));
vi.mock("../components/FoodEntryEditor", () => ({
  FoodEntryEditor: ({
    entry: selected,
    busy,
    errorKey,
    onClose,
    onSave,
    onDelete,
  }: {
    entry: FoodEntryResponse | null;
    busy: boolean;
    errorKey: string;
    onClose: () => void;
    onSave: (entry: FoodEntryResponse, body: UpdateFoodEntryBody) => Promise<boolean>;
    onDelete: (entry: FoodEntryResponse) => Promise<boolean>;
  }) =>
    selected
      ? createElement(
          "div",
          null,
          createElement("span", null, busy ? "history-editor-loading" : "history-editor-idle"),
          errorKey ? createElement("div", { role: "alert" }, errorKey) : null,
          createElement(
            "button",
            {
              type: "button",
              onClick: async () => {
                const saved = await onSave(selected, {
                  name: selected.name,
                  portion: selected.portion,
                  calories: 220,
                  protein: 11,
                  carbs: 30,
                  fats: 4,
                  fiber: 6,
                  day: selected.day,
                  mealType: selected.mealType,
                });
                if (saved) onClose();
              },
            },
            "save-history-entry",
          ),
          createElement(
            "button",
            {
              type: "button",
              onClick: async () => {
                const deleted = await onDelete(selected);
                if (deleted) onClose();
              },
            },
            "delete-history-entry",
          ),
        )
      : null,
}));

function resetHistory() {
  rootStore.history.data.weeklyAverageCalories = 100;
  rootStore.history.data.days = [
    {
      date: "2026-08-14",
      calories: 100,
      goal: 2_000,
      protein: 5,
      carbs: 15,
      fats: 2,
      fiber: 3,
    },
  ];
}

beforeEach(() => {
  resetHistory();
  apiGetDayLog.mockResolvedValue(dayLog);
  rootStore.foodLog.entryUpdate.fetchState = "initial";
  rootStore.foodLog.entryUpdate.errorKey = "";
  rootStore.foodLog.entryUpdate.update.mockImplementation(
    async (_before: FoodEntryResponse, body: UpdateFoodEntryBody) => {
      const updated = { ...entry, ...body };
      rootStore.history.data.days = [
        {
          date: updated.day,
          calories: updated.calories,
          goal: 2_000,
          protein: updated.protein,
          carbs: updated.carbs,
          fats: updated.fats,
          fiber: updated.fiber,
        },
      ];
      return updated;
    },
  );
  rootStore.foodLog.entryDelete.fetchState = "initial";
  rootStore.foodLog.entryDelete.errorKey = "";
  rootStore.foodLog.entryDelete.isLoading = false;
  rootStore.foodLog.entryDelete.remove.mockResolvedValue(entry);
  rootStore.foodLog.entryDelete.restore.mockResolvedValue(entry);
  rootStore.foodLog.mealDuplicate.fetchState = "initial";
  rootStore.foodLog.mealDuplicate.errorKey = "";
  rootStore.foodLog.mealDuplicate.duplicate.mockResolvedValue({ entries: [copiedEntry] });
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("HistoryPage day detail", () => {
  it("leaves responsive width ownership to the application shell", () => {
    const { container } = render(createElement(HistoryPage));

    expect(container.firstElementChild?.className).not.toContain("max-w-md");
  });

  it("opens an itemized day, edits an entry, and shows the reconciled history aggregate", async () => {
    render(createElement(HistoryPage));

    fireEvent.click(screen.getByRole("button", { name: "history.openDay" }));

    await waitFor(() => expect(apiGetDayLog).toHaveBeenCalledWith("2026-08-14"));
    expect(await screen.findByText("history.dayDetail")).toBeTruthy();
    expect(screen.getByText("100 history.calShort")).toBeTruthy();
    expect(screen.getByText("history.itemizedMeals")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Oats" }));
    expect(rootStore.foodLog.entryUpdate.clearError).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "save-history-entry" })));

    await waitFor(() => expect(screen.getByText("220 history.calShort")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "history.backToHistory" }));

    expect(screen.queryByText("history.dayDetail")).toBeNull();
    expect(screen.getByText("220 / 2000 history.calShort")).toBeTruthy();
  });

  it("reacts to entry-save loading and error state while keeping the editor recoverable", async () => {
    let finishFailure!: () => void;
    const pendingFailure = new Promise<void>((resolve) => {
      finishFailure = resolve;
    });
    rootStore.foodLog.entryUpdate.update.mockImplementation(async () => {
      runInAction(() => {
        rootStore.foodLog.entryUpdate.fetchState = "loading";
      });
      await pendingFailure;
      runInAction(() => {
        rootStore.foodLog.entryUpdate.fetchState = "error";
        rootStore.foodLog.entryUpdate.errorKey = "errors.network";
      });
      return undefined;
    });

    render(createElement(HistoryPage));
    fireEvent.click(screen.getByRole("button", { name: "history.openDay" }));
    fireEvent.click(await screen.findByRole("button", { name: "Oats" }));
    fireEvent.click(screen.getByRole("button", { name: "save-history-entry" }));

    expect(await screen.findByText("history-editor-loading")).toBeTruthy();
    await act(async () => finishFailure());

    expect((await screen.findByRole("alert")).textContent).toBe("errors.network");
    expect(screen.getByRole("button", { name: "save-history-entry" })).toBeTruthy();
  });

  it("deletes from the opened day and restores the same entry through Undo", async () => {
    render(createElement(HistoryPage));
    fireEvent.click(screen.getByRole("button", { name: "history.openDay" }));
    await screen.findByRole("button", { name: "Oats" });

    fireEvent.click(screen.getByRole("button", { name: "Oats" }));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "delete-history-entry" })),
    );

    expect(rootStore.foodLog.entryDelete.remove).toHaveBeenCalledWith(entry);
    expect(await screen.findByText("states.emptyDay")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "entryEditor.undo" })));

    expect(rootStore.foodLog.entryDelete.restore).toHaveBeenCalledWith(entry.id);
    expect(await screen.findByRole("button", { name: "Oats" })).toBeTruthy();
  });

  it("duplicates a meal to an explicit destination and opens the editable copied entries", async () => {
    apiGetDayLog.mockImplementation(async (requestedDay: string) =>
      requestedDay === copiedEntry.day
        ? {
            day: copiedEntry.day,
            calorieGoal: 2_000,
            totalCalories: copiedEntry.calories,
            meals: { breakfast: [], lunch: [copiedEntry], dinner: [], snack: [] },
          }
        : dayLog,
    );
    rootStore.foodLog.entryDelete.remove.mockResolvedValue(copiedEntry);
    rootStore.foodLog.entryDelete.restore.mockResolvedValue(copiedEntry);

    render(createElement(HistoryPage));
    fireEvent.click(screen.getByRole("button", { name: "history.openDay" }));
    await screen.findByRole("button", { name: "Oats" });

    fireEvent.click(
      screen.getByRole("button", { name: "history.duplicateMeal:meals.breakfast" }),
    );
    const destinationDay = screen.getByLabelText("entryEditor.day") as HTMLInputElement;
    const destinationMeal = screen.getByRole("combobox", {
      name: "entryEditor.meal",
    });
    expect(destinationDay.value).toBe(localIsoDate());
    expect(destinationMeal.textContent).toContain("meals.breakfast");

    fireEvent.change(destinationDay, { target: { value: copiedEntry.day } });
    fireEvent.click(destinationMeal);
    fireEvent.click(screen.getByRole("option", { name: "meals.lunch" }));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "history.confirmDuplicate" })),
    );

    expect(rootStore.foodLog.mealDuplicate.duplicate).toHaveBeenCalledWith({
      sourceDay: entry.day,
      sourceMealType: "breakfast",
      destinationDay: copiedEntry.day,
      destinationMealType: "lunch",
    });
    expect(await screen.findByText("history.duplicateSuccess:meals.lunch")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "history.openCopiedDay" }));
    expect(await screen.findByRole("button", { name: copiedEntry.name })).toBeTruthy();
    expect(apiGetDayLog).toHaveBeenCalledWith(copiedEntry.day);

    fireEvent.click(screen.getByRole("button", { name: copiedEntry.name }));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "delete-history-entry" })),
    );
    expect(rootStore.foodLog.entryDelete.remove).toHaveBeenCalledWith(copiedEntry);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "entryEditor.undo" })),
    );
    expect(rootStore.foodLog.entryDelete.restore).toHaveBeenCalledWith(copiedEntry.id);
    expect(await screen.findByRole("button", { name: copiedEntry.name })).toBeTruthy();
  });

  it("keeps the duplicate form recoverable when the atomic copy fails", async () => {
    rootStore.foodLog.mealDuplicate.duplicate.mockResolvedValue({ errorKey: "errors.network" });

    render(createElement(HistoryPage));
    fireEvent.click(screen.getByRole("button", { name: "history.openDay" }));
    await screen.findByRole("button", { name: "Oats" });
    fireEvent.click(
      screen.getByRole("button", { name: "history.duplicateMeal:meals.breakfast" }),
    );
    fireEvent.change(screen.getByLabelText("entryEditor.day"), {
      target: { value: copiedEntry.day },
    });
    const destinationMeal = screen.getByRole("combobox", { name: "entryEditor.meal" });
    fireEvent.click(destinationMeal);
    fireEvent.click(screen.getByRole("option", { name: "meals.lunch" }));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "history.confirmDuplicate" })),
    );

    expect((await screen.findByRole("alert")).textContent).toBe("errors.network");
    expect((screen.getByLabelText("entryEditor.day") as HTMLInputElement).value).toBe(
      copiedEntry.day,
    );
    expect(screen.getByRole("combobox", { name: "entryEditor.meal" }).textContent).toContain(
      "meals.lunch",
    );
    expect(screen.getByRole("button", { name: "history.confirmDuplicate" })).toBeTruthy();
  });

  it("keeps an invalid duplicate date in the shared control with field feedback", async () => {
    render(createElement(HistoryPage));
    fireEvent.click(screen.getByRole("button", { name: "history.openDay" }));
    await screen.findByRole("button", { name: "Oats" });
    fireEvent.click(
      screen.getByRole("button", { name: "history.duplicateMeal:meals.breakfast" }),
    );

    const destinationDay = screen.getByLabelText("entryEditor.day") as HTMLInputElement;
    fireEvent.change(destinationDay, { target: { value: "" } });

    expect((await screen.findByRole("alert")).textContent).toBe(
      "entryEditor.validation.date",
    );
    expect(destinationDay.value).toBe("");
    expect(rootStore.foodLog.mealDuplicate.duplicate).not.toHaveBeenCalled();

    fireEvent.change(destinationDay, { target: { value: copiedEntry.day } });
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "history.confirmDuplicate" })),
    );
    expect(rootStore.foodLog.mealDuplicate.duplicate).toHaveBeenCalledWith(
      expect.objectContaining({ destinationDay: copiedEntry.day }),
    );
  });

  it("disables both shared duplicate controls while the copy is pending", async () => {
    render(createElement(HistoryPage));
    fireEvent.click(screen.getByRole("button", { name: "history.openDay" }));
    await screen.findByRole("button", { name: "Oats" });
    fireEvent.click(
      screen.getByRole("button", { name: "history.duplicateMeal:meals.breakfast" }),
    );

    runInAction(() => {
      rootStore.foodLog.mealDuplicate.fetchState = "loading";
    });

    await waitFor(() => {
      expect((screen.getByLabelText("entryEditor.day") as HTMLInputElement).disabled).toBe(true);
      expect(
        (screen.getByRole("combobox", { name: "entryEditor.meal" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    });
  });
});
