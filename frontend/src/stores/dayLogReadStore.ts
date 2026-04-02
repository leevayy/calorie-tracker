import type { DayLogResponse } from "@contracts/food-log";
import { flow, types } from "mobx-state-tree";
import { apiGetDayLog } from "@/api/foodLog";
import { ApiError, toApiError } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

export const DayLogReadStore = types
  .model({
    day: types.maybe(types.string),
    data: types.maybe(types.frozen<DayLogResponse>()),
    fetchState: types.optional(FetchStateModel, "initial"),
    errorKey: types.optional(types.string, ""),
  })
  .views((self) => ({
    get isLoading() {
      return self.fetchState === "loading";
    },
  }))
  .actions((self) => ({
    setData(data: DayLogResponse | undefined) {
      self.data = data;
    },
    setDay(day: string | undefined) {
      self.day = day;
    },
    loadDay: flow(function* (day: string) {
      if (self.fetchState === "loading") return;
      self.day = day;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const data = (yield apiGetDayLog(day)) as DayLogResponse;
        self.data = data;
        self.fetchState = "success";
      } catch (e) {
        self.fetchState = "error";
        self.errorKey = e instanceof ApiError ? e.messageKey : toApiError(e).messageKey;
      }
    }),
  }));
