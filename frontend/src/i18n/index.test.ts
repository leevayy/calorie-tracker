import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { PREFERRED_LANGUAGE_STORAGE_KEY } from "@/utils/preferredLanguage";

function installMemoryStorage(): Storage {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  return storage;
}

let i18n: (typeof import("./index"))["default"];

beforeAll(async () => {
  installMemoryStorage();
  ({ default: i18n } = await import("./index"));
});

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("i18n document synchronization", () => {
  it("updates document metadata and persists each supported language change", async () => {
    installMemoryStorage();
    await i18n.changeLanguage("ru-RU");
    expect(document.documentElement.lang).toBe("ru");
    expect(document.title).toBe("Трекер калорий");
    expect(window.localStorage.getItem(PREFERRED_LANGUAGE_STORAGE_KEY)).toBe("ru");

    await i18n.changeLanguage("en-US");
    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toBe("Calorie Tracker");
    expect(window.localStorage.getItem(PREFERRED_LANGUAGE_STORAGE_KEY)).toBe("en");
  });
});
