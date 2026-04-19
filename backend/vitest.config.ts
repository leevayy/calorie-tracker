import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
      JWT_SECRET: "01234567890123456789012345678901",
    },
  },
});
