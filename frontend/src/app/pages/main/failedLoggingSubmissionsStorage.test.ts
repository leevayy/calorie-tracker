import { beforeEach, describe, expect, it } from "vitest";
import {
  loadFailedLoggingSubmissions,
  saveFailedLoggingSubmissions,
  type PersistedFailedLoggingSubmission,
} from "./failedLoggingSubmissionsStorage";

const firstUserId = "11111111-1111-4111-8111-111111111111";
const secondUserId = "22222222-2222-4222-8222-222222222222";

const failedSubmission: PersistedFailedLoggingSubmission = {
  id: "logging-submission-7",
  text: "  exact failed oats text  ",
  retryFrom: "save",
  errorKey: "errors.network",
  foods: [{
    day: "2026-08-15",
    mealType: "lunch",
    name: "Oats",
    calories: 320,
    protein: 12,
    carbs: 52,
    fats: 7,
    fiber: 8,
    portion: "1 bowl",
  }],
  timing: {
    localDate: "2026-08-15",
    localTimeHm: "12:30",
    clientTimeZone: "Europe/Moscow",
    defaultLogDay: "2026-08-15",
    defaultMealType: "lunch",
  },
};

beforeEach(() => window.sessionStorage.clear());

describe("failed logging submission storage", () => {
  it("round-trips exact retry data only within the authenticated user's scope", () => {
    saveFailedLoggingSubmissions(firstUserId, [failedSubmission]);

    expect(loadFailedLoggingSubmissions(firstUserId)).toEqual([failedSubmission]);
    expect(loadFailedLoggingSubmissions(secondUserId)).toEqual([]);
  });

  it("rejects and removes malformed persisted data", () => {
    saveFailedLoggingSubmissions(firstUserId, [failedSubmission]);
    const key = window.sessionStorage.key(0);
    expect(key).not.toBeNull();
    window.sessionStorage.setItem(key!, JSON.stringify([{ text: "missing retry metadata" }]));

    expect(loadFailedLoggingSubmissions(firstUserId)).toEqual([]);
    expect(window.sessionStorage.getItem(key!)).toBeNull();
  });
});
