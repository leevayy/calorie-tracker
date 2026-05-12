import type { FrequentFoodItem } from "@contracts/food-log";
import { flow, types } from "mobx-state-tree";
import { apiGetFrequentFoods } from "@/api/foodLog";
import { errorMessageKey } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

export const FrequentFoodsWeekReadStore = types
  .model({
    items: types.optional(types.array(types.frozen<FrequentFoodItem>()), []),
    fetchState: types.optional(FetchStateModel, "initial"),
    errorKey: types.optional(types.string, ""),
  })
  .actions((self) => ({
    load: flow(function* (params: { from: string; to: string; limit: number }) {
      if (self.fetchState === "loading") return;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const res = (yield apiGetFrequentFoods(params)) as { items: FrequentFoodItem[] };
        self.items.replace(res.items);
        self.fetchState = "success";
      } catch (e) {
        self.fetchState = "error";
        self.errorKey = errorMessageKey(e);
        self.items.clear();
      }
    }),
  }));
