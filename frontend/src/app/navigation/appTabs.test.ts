import { describe, expect, it } from "vitest";
import {
  APP_TAB_NAV_TITLE_KEYS,
  DEFAULT_APP_TAB_SEGMENT,
  indexToPath,
  isAppTabSegment,
  pathToIndex,
  pathToTitleKey,
} from "@/app/navigation/appTabs";

describe("appTabs", () => {
  it("isAppTabSegment accepts only known segments", () => {
    expect(isAppTabSegment("app")).toBe(true);
    expect(isAppTabSegment("settings")).toBe(true);
    expect(isAppTabSegment("history")).toBe(true);
    expect(isAppTabSegment("foo")).toBe(false);
    expect(isAppTabSegment(undefined)).toBe(false);
  });

  it("DEFAULT_APP_TAB_SEGMENT matches invalid-tab redirect target", () => {
    expect(DEFAULT_APP_TAB_SEGMENT).toBe("app");
  });

  it("pathToIndex maps known paths to carousel index", () => {
    expect(pathToIndex("/settings")).toBe(0);
    expect(pathToIndex("/app")).toBe(1);
    expect(pathToIndex("/history")).toBe(2);
  });

  it("pathToIndex falls back to home index for unknown paths", () => {
    expect(pathToIndex("/nope")).toBe(1);
    expect(pathToIndex("")).toBe(1);
  });

  it("indexToPath clamps to valid paths", () => {
    expect(indexToPath(-1)).toBe("/settings");
    expect(indexToPath(99)).toBe("/history");
  });

  it("pathToTitleKey follows pathToIndex", () => {
    expect(pathToTitleKey("/settings")).toBe(APP_TAB_NAV_TITLE_KEYS[0]);
    expect(pathToTitleKey("/app")).toBe(APP_TAB_NAV_TITLE_KEYS[1]);
    expect(pathToTitleKey("/history")).toBe(APP_TAB_NAV_TITLE_KEYS[2]);
    expect(pathToTitleKey("/unknown")).toBe(APP_TAB_NAV_TITLE_KEYS[1]);
  });
});
