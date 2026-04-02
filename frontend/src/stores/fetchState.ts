import { types } from "mobx-state-tree";

export const FetchStateModel = types.enumeration("FetchState", [
  "initial",
  "loading",
  "success",
  "error",
]);

export type FetchState = (typeof FetchStateModel)["Type"];
