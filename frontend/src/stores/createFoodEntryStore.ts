import type { CreateFoodEntryBody, FoodEntryResponse } from "@contracts/food-log";
import { flow, getRoot, types } from "mobx-state-tree";
import { apiCreateFoodEntry } from "@/api/foodLog";
import { errorMessageKey } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

type RootWithFoodLog = {
  foodLog: { applyCreatedEntry(day: string, entry: FoodEntryResponse): void };
};

export const CreateFoodEntryStore = types
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
    create: flow(function* (day: string, body: CreateFoodEntryBody) {
      if (self.fetchState === "loading") return;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const entry = (yield apiCreateFoodEntry(day, body)) as FoodEntryResponse;
        const root = getRoot(self) as RootWithFoodLog;
        root.foodLog.applyCreatedEntry(day, entry);
        self.fetchState = "success";
      } catch (e) {
        self.fetchState = "error";
        self.errorKey = errorMessageKey(e);
      }
    }),
  }));
