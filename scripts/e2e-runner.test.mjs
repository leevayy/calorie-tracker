import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  createBrowserTestEnvironment,
  PUBLIC_E2E_CONTROL_HANDLE,
  PUBLIC_E2E_TEST_EMAIL,
  PUBLIC_E2E_TEST_PASSWORD,
} from "./e2e-environment.mjs";
import { pipeProcessOutputToWritable } from "./e2e-process.mjs";

const execFileAsync = promisify(execFile);

test("keeps the shared service log open until stdout and stderr are completely flushed", async () => {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const destination = new PassThrough();
  const logged = [];
  destination.on("data", (chunk) => logged.push(chunk));

  const settled = pipeProcessOutputToWritable({ stdout, stderr }, destination);
  stdout.end("stdout completed first\n");
  await new Promise((resolvePromise) => setImmediate(resolvePromise));

  assert.equal(destination.writableEnded, false);
  stderr.end("stderr completed last\n");
  await settled;

  assert.equal(destination.writableFinished, true);
  assert.equal(
    Buffer.concat(logged).toString("utf8"),
    "stdout completed first\nstderr completed last\n",
  );
});

test("owns an early destination failure while process output is still open", async (context) => {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const destination = new PassThrough();
  const unhandled = [];
  const recordUnhandled = (error) => unhandled.push(error);
  process.on("unhandledRejection", recordUnhandled);
  context.after(() => process.off("unhandledRejection", recordUnhandled));

  const settled = pipeProcessOutputToWritable({ stdout, stderr }, destination);
  const expectedFailure = assert.rejects(settled, /destination failed early/);
  destination.destroy(new Error("destination failed early"));
  await new Promise((resolvePromise) => setImmediate(resolvePromise));
  stdout.end("late stdout");
  stderr.end("late stderr");
  await expectedFailure;
  await new Promise((resolvePromise) => setImmediate(resolvePromise));

  assert.deepEqual(unhandled, []);
});

test("keeps configured secrets out of the browser test environment", () => {
  const environment = createBrowserTestEnvironment({
    PATH: "/usr/bin",
    CI: "true",
    E2E_BASE_URL: "http://127.0.0.1:4173",
    NODE_OPTIONS: "--import=/tmp/untrusted-loader.mjs",
    DATABASE_URL: "postgresql://real-secret",
    JWT_SECRET: "real-jwt-secret",
    E2E_CONTROL_SECRET: "configured-control-secret",
    E2E_TEST_EMAIL: "personal@example.com",
    E2E_TEST_PASSWORD: "configured-password",
    YANDEX_AI_STUDIO_API_KEY: "provider-api-key",
    YANDEX_FOLDER_ID: "provider-folder-id",
    GITHUB_TOKEN: "github-secret-token",
    AWS_ACCESS_KEY_ID: "unknown-secret-name",
  });

  assert.equal(environment.PATH, "/usr/bin");
  assert.equal(environment.CI, "true");
  assert.equal(environment.E2E_BASE_URL, "http://127.0.0.1:4173");
  assert.equal(environment.E2E_CONTROL_SECRET, PUBLIC_E2E_CONTROL_HANDLE);
  assert.equal(environment.E2E_TEST_EMAIL, PUBLIC_E2E_TEST_EMAIL);
  assert.equal(environment.E2E_TEST_PASSWORD, PUBLIC_E2E_TEST_PASSWORD);
  assert.match(environment.E2E_BROWSER_GUARD_SALT, /^[0-9a-f]{32}$/);
  const forbiddenHashes = JSON.parse(environment.E2E_BROWSER_FORBIDDEN_VALUE_HASHES);
  assert.equal(forbiddenHashes.length, 10);
  assert.ok(forbiddenHashes.every((value) => /^[0-9a-f]{64}$/.test(value)));
  for (const name of [
    "DATABASE_URL",
    "JWT_SECRET",
    "YANDEX_AI_STUDIO_API_KEY",
    "YANDEX_FOLDER_ID",
    "GITHUB_TOKEN",
    "AWS_ACCESS_KEY_ID",
    "NODE_OPTIONS",
  ]) {
    assert.equal(environment[name], undefined);
  }
  assert.doesNotMatch(
    JSON.stringify(environment),
    /real-secret|personal@example|provider-api-key|unknown-secret-name/,
  );
});

test("allows proxy and certificate settings only for browser installation", () => {
  const configured = {
    PATH: "/usr/bin",
    HTTPS_PROXY: "http://proxy.example.invalid:8080",
    NODE_EXTRA_CA_CERTS: "/tmp/e2e-ca.pem",
  };

  assert.equal(createBrowserTestEnvironment(configured).HTTPS_PROXY, undefined);
  const installEnvironment = createBrowserTestEnvironment(configured, {
    allowInstallNetworkConfiguration: true,
  });
  assert.equal(installEnvironment.HTTPS_PROXY, configured.HTTPS_PROXY);
  assert.equal(installEnvironment.NODE_EXTRA_CA_CERTS, configured.NODE_EXTRA_CA_CERTS);
});

test("listing Playwright tests preserves retained run evidence", async (context) => {
  const artifactBoundary = join(process.cwd(), "artifacts/playwright/redacted");
  await mkdir(artifactBoundary, { recursive: true });
  const artifactRoot = await mkdtemp(join(artifactBoundary, "list-evidence-"));
  context.after(() => rm(artifactRoot, { recursive: true, force: true }));
  const results = join(artifactRoot, "results.json");
  const htmlReport = join(artifactRoot, "html-report", "index.html");
  const retainedVideo = join(artifactRoot, "test-results", "retained", "video.webm");
  const sentinel = '{"retained":"completed-run-evidence"}\n';
  const htmlSentinel = "<p>retained completed-run report</p>\n";
  const videoSentinel = "retained-video-evidence";
  await mkdir(join(artifactRoot, "html-report"), { recursive: true });
  await mkdir(join(artifactRoot, "test-results", "retained"), { recursive: true });
  await writeFile(results, sentinel);
  await writeFile(htmlReport, htmlSentinel);
  await writeFile(retainedVideo, videoSentinel);

  await execFileAsync(process.execPath, ["scripts/e2e.mjs", "list"], {
    cwd: process.cwd(),
    env: { ...process.env, E2E_ARTIFACT_DIR: artifactRoot },
  });

  assert.equal(await readFile(results, "utf8"), sentinel);
  assert.equal(await readFile(htmlReport, "utf8"), htmlSentinel);
  assert.equal(await readFile(retainedVideo, "utf8"), videoSentinel);
});
