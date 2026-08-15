import type { ParseFoodRequest, ParseFoodResponse } from "@contracts/ai-food";
import { flow, types } from "mobx-state-tree";
import { apiParseFood } from "@/api/aiFood";
import { errorMessageKey } from "@/api/errors";
import { FetchStateModel } from "./fetchState";

export const AiParseFoodStore = types
  .model({
    data: types.maybe(types.frozen<ParseFoodResponse>()),
    fetchState: types.optional(FetchStateModel, "initial"),
    errorKey: types.optional(types.string, ""),
    pendingCount: types.optional(types.number, 0),
  })
  .views((self) => ({
    get isLoading() {
      return self.pendingCount > 0;
    },
  }))
  .actions((self) => ({
    parse: flow(function* (body: ParseFoodRequest) {
      self.pendingCount += 1;
      self.fetchState = "loading";
      self.errorKey = "";
      try {
        const data = (yield apiParseFood(body)) as ParseFoodResponse;
        self.data = data;
        return { data };
      } catch (e) {
        const errorKey = errorMessageKey(e);
        self.errorKey = errorKey;
        return { errorKey };
      } finally {
        self.pendingCount -= 1;
        self.fetchState = self.pendingCount > 0 ? "loading" : self.errorKey ? "error" : "success";
      }
    }),
  }));
