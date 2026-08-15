import type { FoodEntryResponse } from "@contracts/food-log";
import { flow, getRoot, types } from "mobx-state-tree";
import { apiDeleteFoodEntry, apiRestoreFoodEntry } from "@/api/foodLog";
import { errorMessageKey } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

type RootWithFoodEntryTargets = {
  foodLog: {
    applyDeletedEntry(entry: FoodEntryResponse): void;
    applyRestoredEntry(entry: FoodEntryResponse): void;
  };
  history: {
    applyDeletedEntry(entry: FoodEntryResponse): void;
    applyRestoredEntry(entry: FoodEntryResponse): void;
  };
};

export const DeleteFoodEntryStore = types
  .model({
    fetchState: types.optional(FetchStateModel, "initial"),
    errorKey: types.optional(types.string, ""),
  })
  .views((self) => ({
    get isLoading() {
      return self.fetchState === "loading";
    },
  }))
  .actions((self) => ({
    clearError() {
      if (self.fetchState === "loading") return;
      self.fetchState = "initial";
      self.errorKey = "";
    },
    remove: flow(function* (entry: FoodEntryResponse) {
      if (self.fetchState === "loading") return undefined;
      self.fetchState = "loading";
      self.errorKey = "";
      const root = getRoot(self) as RootWithFoodEntryTargets;
      root.foodLog.applyDeletedEntry(entry);
      root.history.applyDeletedEntry(entry);
      try {
        const deleted = (yield apiDeleteFoodEntry(entry.id)) as FoodEntryResponse;
        self.fetchState = "success";
        return deleted;
      } catch (e) {
        root.foodLog.applyRestoredEntry(entry);
        root.history.applyRestoredEntry(entry);
        self.fetchState = "error";
        self.errorKey = errorMessageKey(e);
        return undefined;
      }
    }),
    restore: flow(function* (entryId: string) {
      if (self.fetchState === "loading") return undefined;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const restored = (yield apiRestoreFoodEntry(entryId)) as FoodEntryResponse;
        const root = getRoot(self) as RootWithFoodEntryTargets;
        root.foodLog.applyRestoredEntry(restored);
        root.history.applyRestoredEntry(restored);
        self.fetchState = "success";
        return restored;
      } catch (e) {
        self.fetchState = "error";
        self.errorKey = errorMessageKey(e);
        return undefined;
      }
    }),
  }));
