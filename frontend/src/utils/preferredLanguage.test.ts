import { beforeEach, describe, expect, it } from "vitest";
import {
  PREFERRED_LANGUAGE_STORAGE_KEY,
  initialPreferredLanguage,
  loadPersistedPreferredLanguage,
  persistPreferredLanguage,
  preferredLanguageFromCode,
} from "./preferredLanguage";

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

beforeEach(() => installMemoryStorage());

describe("preferred language lifecycle", () => {
  it("normalizes supported browser language tags", () => {
    expect(preferredLanguageFromCode("ru-RU")).toBe("ru");
    expect(preferredLanguageFromCode("EN_us")).toBe("en");
    expect(preferredLanguageFromCode("de-DE")).toBeNull();
  });

  it("persists only supported language values", () => {
    persistPreferredLanguage("ru-RU");
    expect(window.localStorage.getItem(PREFERRED_LANGUAGE_STORAGE_KEY)).toBe("ru");
    expect(loadPersistedPreferredLanguage()).toBe("ru");

    persistPreferredLanguage("not-a-locale");
    expect(window.localStorage.getItem(PREFERRED_LANGUAGE_STORAGE_KEY)).toBe("ru");
  });

  it("uses the persisted language before browser defaults", () => {
    window.localStorage.setItem(PREFERRED_LANGUAGE_STORAGE_KEY, "ru");
    expect(initialPreferredLanguage()).toBe("ru");
  });

  it("ignores corrupt persisted values", () => {
    window.localStorage.setItem(PREFERRED_LANGUAGE_STORAGE_KEY, "unsupported");
    expect(loadPersistedPreferredLanguage()).toBeNull();
  });
});
