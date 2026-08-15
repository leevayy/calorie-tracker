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
  })
  .views((self) => ({
    get isLoading() {
      return self.fetchState === "loading";
    },
  }))
  .actions((self) => ({
    create: flow(function* (entries: CreateFoodEntryRequest[]) {
      if (self.fetchState === "loading" || entries.length === 0) return undefined;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const response = (yield apiCreateFoodEntries({ entries })) as {
          entries: FoodEntryResponse[];
        };
        const root = getRoot(self) as RootWithFoodEntryTargets;
        root.foodLog.applyCreatedEntries(response.entries);
        root.history.applyCreatedEntries(response.entries);
        self.fetchState = "success";
        return response.entries;
      } catch (e) {
        self.fetchState = "error";
        self.errorKey = errorMessageKey(e);
        return undefined;
      }
    }),
  }));
