import type { DailyTipRequest, DailyTipResponse } from "@contracts/daily-tip";
import { flow, types } from "mobx-state-tree";
import { apiPostDailyTip } from "@/api/dailyTip";
import { errorMessageKey } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

export const DailyTipStore = types
  .model({
    data: types.maybe(types.frozen<DailyTipResponse>()),
    fetchState: types.optional(FetchStateModel, "initial"),
    errorKey: types.optional(types.string, ""),
  })
  .views((self) => ({
    get isLoading() {
      return self.fetchState === "loading";
    },
  }))
  .actions((self) => ({
    fetchTip: flow(function* (body: DailyTipRequest, options?: { force?: boolean }) {
      if (self.fetchState === "loading" && !options?.force) return;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const data = (yield apiPostDailyTip(body)) as DailyTipResponse;
        self.data = data;
        self.fetchState = "success";
      } catch (e) {
        self.fetchState = "error";
        self.errorKey = errorMessageKey(e);
      }
    }),
  }));
