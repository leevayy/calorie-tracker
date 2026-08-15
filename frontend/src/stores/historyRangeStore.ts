import type { FoodEntryResponse } from "@contracts/food-log";
import type { HistoryRangeResponse } from "@contracts/history";
import { flow, types } from "mobx-state-tree";
import { apiGetHistory } from "@/api/history";
import { errorMessageKey } from "@/api/errors";
import { FetchStateModel } from "./fetchState";
import { applyHistoryEntryChanges } from "./historyMerge";

export const HistoryRangeStore = types
  .model({
    data: types.maybe(types.frozen<HistoryRangeResponse>()),
    today: types.maybe(types.string),
    fetchState: types.optional(FetchStateModel, "initial"),
    errorKey: types.optional(types.string, ""),
  })
  .views((self) => ({
    get isLoading() {
      return self.fetchState === "loading";
    },
  }))
  .actions((self) => ({
    applyCreatedEntries(entries: FoodEntryResponse[]) {
      if (!self.data) return;
      self.data = applyHistoryEntryChanges(
        self.data,
        entries.map((entry) => ({ entry, direction: 1 as const })),
        self.today,
      );
    },
    applyUpdatedEntry(before: FoodEntryResponse, after: FoodEntryResponse) {
      if (!self.data) return;
      self.data = applyHistoryEntryChanges(
        self.data,
        [
          { entry: before, direction: -1 },
          { entry: after, direction: 1 },
        ],
        self.today,
      );
    },
    applyDeletedEntry(entry: FoodEntryResponse) {
      if (!self.data) return;
      self.data = applyHistoryEntryChanges(
        self.data,
        [{ entry, direction: -1 }],
        self.today,
      );
    },
    applyRestoredEntry(entry: FoodEntryResponse) {
      if (!self.data) return;
      self.data = applyHistoryEntryChanges(
        self.data,
        [{ entry, direction: 1 }],
        self.today,
      );
    },
  }))
  .actions((self) => ({
    loadRange: flow(function* (from: string, to: string, today: string) {
      if (self.fetchState === "loading") return;
      self.today = today;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const data = (yield apiGetHistory(from, to, today)) as HistoryRangeResponse;
        self.data = data;
        self.fetchState = "success";
      } catch (e) {
        self.fetchState = "error";
        self.errorKey = errorMessageKey(e);
      }
    }),
  }));
