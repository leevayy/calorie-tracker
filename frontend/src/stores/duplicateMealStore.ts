import type { DuplicateMealBody, FoodEntryResponse } from "@contracts/food-log";
import { flow, getRoot, types } from "mobx-state-tree";
import { apiDuplicateMeal } from "@/api/foodLog";
import { errorMessageKey } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

type RootWithFoodEntryTargets = {
  foodLog: { applyCreatedEntries(entries: FoodEntryResponse[]): void };
  history: { applyCreatedEntries(entries: FoodEntryResponse[]): void };
};

export const DuplicateMealStore = types
  .model({
    fetchState: types.optional(FetchStateModel, "initial"),
    errorKey: types.optional(types.string, ""),
  })
  .actions((self) => ({
    duplicate: flow(function* (body: DuplicateMealBody) {
      if (self.fetchState === "loading") return undefined;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const response = (yield apiDuplicateMeal(body)) as { entries: FoodEntryResponse[] };
        const root = getRoot(self) as RootWithFoodEntryTargets;
        root.foodLog.applyCreatedEntries(response.entries);
        root.history.applyCreatedEntries(response.entries);
        self.fetchState = "success";
        return { entries: response.entries };
      } catch (error) {
        self.fetchState = "error";
        self.errorKey = errorMessageKey(error);
        return { errorKey: self.errorKey };
      }
    }),
  }));
