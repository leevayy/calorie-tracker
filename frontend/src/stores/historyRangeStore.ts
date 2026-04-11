import type { HistoryRangeResponse } from "@contracts/history";
import { flow, types } from "mobx-state-tree";
import { apiGetHistory } from "@/api/history";
import { errorMessageKey } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

export const HistoryRangeStore = types
  .model({
    data: types.maybe(types.frozen<HistoryRangeResponse>()),
    fetchState: types.optional(FetchStateModel, "initial"),
    errorKey: types.optional(types.string, ""),
  })
  .views((self) => ({
    get isLoading() {
      return self.fetchState === "loading";
    },
  }))
  .actions((self) => ({
    loadRange: flow(function* (from: string, to: string) {
      if (self.fetchState === "loading") return;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const data = (yield apiGetHistory(from, to)) as HistoryRangeResponse;
        self.data = data;
        self.fetchState = "success";
      } catch (e) {
        self.fetchState = "error";
        self.errorKey = errorMessageKey(e);
      }
    }),
  }));
