import type { CreateFoodEntryRequest, FoodEntryResponse } from "@contracts/food-log";
import { flow, getRoot, types } from "mobx-state-tree";
import { apiCreateFoodEntries } from "@/api/foodLog";
import { errorMessageKey } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

type RootWithFoodEntryTargets = {
  foodLog: { applyCreatedEntries(entries: FoodEntryResponse[]): void };
  history: { applyCreatedEntries(entries: FoodEntryResponse[]): void };
};

export const CreateFoodEntriesStore = types
  .model({
    fetchState: types.optional(FetchStateModel, "initial"),
    errorKey: types.optional(types.string, ""),
    pendingCount: types.optional(types.number, 0),
  })
  .views((self) => ({
    get isLoading() {
      return self.pendingCount > 0;
    },
  }))
  .actions((self) => ({
    create: flow(function* (entries: CreateFoodEntryRequest[]) {
      if (entries.length === 0) return undefined;
      self.pendingCount += 1;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const response = (yield apiCreateFoodEntries({ entries })) as {
          entries: FoodEntryResponse[];
        };
        const root = getRoot(self) as RootWithFoodEntryTargets;
        root.foodLog.applyCreatedEntries(response.entries);
        root.history.applyCreatedEntries(response.entries);
        return { entries: response.entries };
      } catch (e) {
        const errorKey = errorMessageKey(e);
        self.errorKey = errorKey;
        return { errorKey };
      } finally {
        self.pendingCount -= 1;
        self.fetchState = self.pendingCount > 0 ? "loading" : self.errorKey ? "error" : "success";
      }
    }),
  }));
