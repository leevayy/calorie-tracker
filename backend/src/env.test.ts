import { describe, expect, test } from "vitest";
import { parseEnv } from "./env.ts";

const required = {
  DATABASE_URL: "postgresql://test:test@localhost/test",
  JWT_SECRET: "01234567890123456789012345678901",
};

describe("E2E environment activation", () => {
  test("is disabled by default", () => {
    expect(parseEnv(required).E2E_TEST_MODE).toBe(false);
  });

  test("requires NODE_ENV=test and a strong control secret", () => {
    expect(() =>
      parseEnv({
        ...required,
        NODE_ENV: "production",
        E2E_TEST_MODE: "true",
        E2E_CONTROL_SECRET: "0123456789abcdef",
      }),
    ).toThrow();
    expect(() =>
      parseEnv({
        ...required,
        NODE_ENV: "test",
        E2E_TEST_MODE: "true",
        E2E_CONTROL_SECRET: "short",
      }),
    ).toThrow();
  });

  test("accepts the complete explicit E2E test configuration", () => {
    const parsed = parseEnv({
      ...required,
      NODE_ENV: "test",
      E2E_TEST_MODE: "1",
      E2E_LIVE_AI: "1",
      E2E_CONTROL_SECRET: "0123456789abcdef",
    });
    expect(parsed.E2E_TEST_MODE).toBe(true);
    expect(parsed.E2E_LIVE_AI).toBe(true);
    expect(parsed.E2E_CONTROL_SECRET).toBe("0123456789abcdef");
  });

  test("does not permit live AI without the guarded E2E environment", () => {
    expect(() =>
      parseEnv({
        ...required,
        NODE_ENV: "test",
        E2E_LIVE_AI: "1",
      }),
    ).toThrow();
  });
});
