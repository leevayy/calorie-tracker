import type { FoodEntryResponse } from "@contracts/food-log";
import { types } from "mobx-state-tree";
import { CreateFoodEntryStore } from "./createFoodEntryStore";
import { DayLogReadStore } from "./dayLogReadStore";
import { DeleteFoodEntryStore } from "./deleteFoodEntryStore";
import { mergeFoodEntry, removeFoodEntryById } from "./foodLogMerge";

export const FoodLogStore = types
  .model({
    dayRead: DayLogReadStore,
    entryCreate: CreateFoodEntryStore,
    entryDelete: DeleteFoodEntryStore,
  })
  .actions((self) => ({
    applyCreatedEntry(day: string, entry: FoodEntryResponse) {
      if (self.dayRead.day !== day || !self.dayRead.data) return;
      self.dayRead.setData(mergeFoodEntry(self.dayRead.data, entry));
    },
    applyDeletedEntry(entryId: string) {
      if (!self.dayRead.data) return;
      const next = removeFoodEntryById(self.dayRead.data, entryId);
      if (next) self.dayRead.setData(next);
    },
  }));
