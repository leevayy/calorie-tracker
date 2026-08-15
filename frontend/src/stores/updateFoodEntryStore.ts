import type { FoodEntryResponse, UpdateFoodEntryBody } from "@contracts/food-log";
import { flow, getRoot, types } from "mobx-state-tree";
import { apiUpdateFoodEntry } from "@/api/foodLog";
import { errorMessageKey } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

type RootWithFoodEntryTargets = {
  foodLog: {
    applyUpdatedEntry(before: FoodEntryResponse, after: FoodEntryResponse): void;
  };
  history: {
    applyUpdatedEntry(before: FoodEntryResponse, after: FoodEntryResponse): void;
  };
};

export const UpdateFoodEntryStore = types
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
    update: flow(function* (before: FoodEntryResponse, body: UpdateFoodEntryBody) {
      if (self.fetchState === "loading") return undefined;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const after = (yield apiUpdateFoodEntry(before.id, body)) as FoodEntryResponse;
        const root = getRoot(self) as RootWithFoodEntryTargets;
        root.foodLog.applyUpdatedEntry(before, after);
        root.history.applyUpdatedEntry(before, after);
        self.fetchState = "success";
        return after;
      } catch (e) {
        self.fetchState = "error";
        self.errorKey = errorMessageKey(e);
        return undefined;
      }
    }),
  }));
