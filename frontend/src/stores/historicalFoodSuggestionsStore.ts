import type { HistoricalFoodSuggestion } from "@contracts/food-log";
import { flow, types } from "mobx-state-tree";
import { apiGetHistoricalFoodSuggestions } from "@/api/foodLog";
import { errorMessageKey } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

export const HistoricalFoodSuggestionsStore = types
  .model({
    query: types.optional(types.string, ""),
    items: types.optional(types.array(types.frozen<HistoricalFoodSuggestion>()), []),
    fetchState: types.optional(FetchStateModel, "initial"),
    errorKey: types.optional(types.string, ""),
    requestId: types.optional(types.integer, 0),
  })
  .actions((self) => ({
    clear() {
      self.requestId += 1;
      self.query = "";
      self.items.clear();
      self.fetchState = "initial";
      self.errorKey = "";
    },
    load: flow(function* (query: string, limit = 8) {
      const normalized = query.trim();
      if (!normalized) {
        self.requestId += 1;
        self.query = "";
        self.items.clear();
        self.fetchState = "initial";
        self.errorKey = "";
        return;
      }

      const requestId = self.requestId + 1;
      self.requestId = requestId;
      self.query = normalized;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const response = (yield apiGetHistoricalFoodSuggestions({
          query: normalized,
          limit,
        })) as { items: HistoricalFoodSuggestion[] };
        if (self.requestId !== requestId) return;
        self.items.replace(response.items);
        self.fetchState = "success";
      } catch (error) {
        if (self.requestId !== requestId) return;
        self.fetchState = "error";
        self.errorKey = errorMessageKey(error);
        self.items.clear();
      }
    }),
  }));
