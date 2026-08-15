import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const artifactRoot = process.env.E2E_ARTIFACT_DIR ?? "artifacts/playwright/redacted";
const liveAiEnabled = process.env.E2E_LIVE_AI === "1";

const deterministicProjects = [
  {
    name: "desktop-chromium",
    testIgnore: /.*\.live\.spec\.ts/,
    grepInvert: /@live-ai/,
    use: { ...devices["Desktop Chrome"] },
  },
  {
    name: "mobile-webkit",
    testIgnore: /.*\.live\.spec\.ts/,
    grepInvert: /@live-ai/,
    use: { ...devices["iPhone 13"] },
  },
];

const liveAiProjects = liveAiEnabled
  ? [
      {
        name: "live-ai-chromium",
        testMatch: /.*\.live\.spec\.ts/,
        grep: /@live-ai/,
        use: { ...devices["Desktop Chrome"] },
      },
    ]
  : [];

export default defineConfig({
  testDir: "./e2e",
  outputDir: `${artifactRoot}/test-results`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 45_000,
  expect: { timeout: 10_000 },
  preserveOutput: "always",
  reporter: [
    ["line"],
    ["html", { outputFolder: `${artifactRoot}/html-report`, open: "never" }],
    ["json", { outputFile: `${artifactRoot}/results.json` }],
  ],
  use: {
    baseURL,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light",
    video: "on",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [...deterministicProjects, ...liveAiProjects],
});
