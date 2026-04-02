import { flow, getRoot, types } from "mobx-state-tree";
import { apiDeleteFoodEntry } from "@/api/foodLog";
import { ApiError, toApiError } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

type RootWithFoodLog = {
  foodLog: { applyDeletedEntry(entryId: string): void };
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
    remove: flow(function* (entryId: string) {
      if (self.fetchState === "loading") return;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        yield apiDeleteFoodEntry(entryId);
        const root = getRoot(self) as RootWithFoodLog;
        root.foodLog.applyDeletedEntry(entryId);
        self.fetchState = "success";
      } catch (e) {
        self.fetchState = "error";
        self.errorKey = e instanceof ApiError ? e.messageKey : toApiError(e).messageKey;
      }
    }),
  }));
