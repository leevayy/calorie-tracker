#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertManagedArtifactsSafe,
  finalizeManagedArtifactRun,
  resetManagedArtifacts,
  resolveManagedArtifactLayout,
  sensitiveArtifactValues,
} from "./e2e-artifacts.mjs";
import { createOnceAsync, createSignalShutdown } from "./e2e-lifecycle.mjs";
import { assertManagedPostgresDataPath } from "./e2e-path-safety.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const envFile = join(root, ".env.e2e");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const command = process.argv[2] ?? "test";
const nodeBinDir = dirname(process.execPath);
const childPath = [nodeBinDir, process.env.PATH].filter(Boolean).join(":");
const { artifactRoot } = resolveManagedArtifactLayout(root, process.env.E2E_ARTIFACT_DIR);
const logDir = join(artifactRoot, "service-logs");
const browserPath = resolve(root, process.env.PLAYWRIGHT_BROWSERS_PATH ?? ".cache/playwright-browsers");
const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3000";
const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const controlSecret = process.env.E2E_CONTROL_SECRET;
const pgPort = Number(process.env.E2E_POSTGRES_PORT ?? "55432");
const pgDatabase = process.env.E2E_POSTGRES_DB ?? "calorie_tracker_e2e";
const pgData = resolve(root, process.env.E2E_POSTGRES_DATA ?? ".cache/e2e-postgres");
const defaultJwtSecret = "e2e-only-jwt-secret-at-least-16-characters";
const managedDatabaseUrl = `postgresql://postgres@127.0.0.1:${pgPort}/${pgDatabase}`;
let artifactDatabaseUrl = process.env.DATABASE_URL ?? managedDatabaseUrl;

let backendProcess;
let frontendProcess;
let managedPostgres = false;
const commandProcesses = new Set();

function childEnv(extra = {}) {
  return {
    ...process.env,
    PATH: childPath,
    PLAYWRIGHT_BROWSERS_PATH: browserPath,
    E2E_ARTIFACT_DIR: artifactRoot,
    E2E_BASE_URL: baseUrl,
    E2E_API_URL: apiUrl,
    ...extra,
  };
}

function artifactCanaries(databaseUrl = process.env.DATABASE_URL ?? managedDatabaseUrl) {
  return sensitiveArtifactValues({
    ...process.env,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: process.env.JWT_SECRET ?? defaultJwtSecret,
  });
}

function executable(name, extraCandidates = []) {
  const candidates = [
    ...extraCandidates,
    `/opt/homebrew/opt/postgresql@16/bin/${name}`,
    `/usr/local/opt/postgresql@16/bin/${name}`,
  ];
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  const found = spawnSync("sh", ["-c", `command -v ${name}`], {
    encoding: "utf8",
    env: childEnv(),
  }).stdout.trim();
  if (found) return found;
  throw new Error(`Required executable was not found: ${name}`);
}

async function run(file, args, options = {}) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(file, args, {
      cwd: options.cwd ?? root,
      env: options.env ?? childEnv(),
      stdio: "inherit",
    });
    commandProcesses.add(child);
    child.once("error", (error) => {
      commandProcesses.delete(child);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      commandProcesses.delete(child);
      if (code === 0) resolvePromise();
      else reject(new Error(`${file} exited with ${code ?? signal}`));
    });
  });
}

function assertDisposableDatabase(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("E2E database URL is invalid");
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!/(?:^|[-_])(test|e2e)(?:[-_]|$)/i.test(name)) {
    throw new Error("Refusing to use a database whose name is not visibly dedicated to E2E tests");
  }
}

async function prepareDatabase() {
  const shouldManage = process.env.E2E_MANAGE_POSTGRES === "1" || !process.env.DATABASE_URL;
  let databaseUrl = process.env.DATABASE_URL;

  if (shouldManage) {
    assertManagedPostgresDataPath(root, pgData);
    const pgBin = process.env.E2E_POSTGRES_BIN;
    const candidate = (name) => (pgBin ? [join(pgBin, name)] : []);
    const initdb = executable("initdb", candidate("initdb"));
    const pgCtl = executable("pg_ctl", candidate("pg_ctl"));
    const createdb = executable("createdb", candidate("createdb"));

    await rm(pgData, { recursive: true, force: true });
    await mkdir(pgData, { recursive: true });
    await mkdir(logDir, { recursive: true });
    await run(initdb, ["-D", pgData, "--username=postgres", "--auth=trust", "--no-locale"]);
    await run(pgCtl, [
      "-D",
      pgData,
      "-l",
      join(logDir, "postgres.log"),
      "-o",
      `-p ${pgPort} -h 127.0.0.1`,
      "-w",
      "start",
    ]);
    managedPostgres = true;
    await run(createdb, ["--host=127.0.0.1", `--port=${pgPort}`, "--username=postgres", pgDatabase]);
    databaseUrl = managedDatabaseUrl;
  }

  if (!databaseUrl) throw new Error("DATABASE_URL is required for E2E tests");
  assertDisposableDatabase(databaseUrl);
  artifactDatabaseUrl = databaseUrl;
  const env = backendEnv(databaseUrl);
  await run(process.execPath, ["--experimental-strip-types", "src/db/migrate.ts"], {
    cwd: join(root, "backend"),
    env,
  });
  return databaseUrl;
}

function backendEnv(databaseUrl) {
  if (!controlSecret || controlSecret.length < 16) {
    throw new Error("E2E_CONTROL_SECRET with at least 16 characters is required");
  }
  const parsedApi = new URL(apiUrl);
  return childEnv({
    NODE_ENV: "test",
    HOST: parsedApi.hostname,
    PORT: parsedApi.port || "3000",
    DATABASE_URL: databaseUrl,
    JWT_SECRET: process.env.JWT_SECRET ?? defaultJwtSecret,
    CORS_ALLOWED_ORIGINS: baseUrl,
    RATE_LIMIT_MAX_REQUESTS_PER_MINUTE: "10000",
    RATE_LIMIT_COOLDOWN_SECONDS: "1",
    E2E_TEST_MODE: "1",
    E2E_CONTROL_SECRET: controlSecret,
  });
}

function startLoggedService(file, args, { cwd, env, logName }) {
  const log = createWriteStream(join(logDir, logName), { flags: "a" });
  const child = spawn(file, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.once("exit", () => log.end());
  return child;
}

async function waitFor(url, label, processRef) {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    if (processRef.exitCode != null) {
      throw new Error(`${label} exited before becoming ready; inspect ${logDir}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${label} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`${label} did not become ready: ${String(lastError)}`);
}

async function buildAndStartServices(databaseUrl) {
  await mkdir(logDir, { recursive: true });
  await run(join(root, "frontend/node_modules/.bin/vite"), ["build"], {
    cwd: join(root, "frontend"),
    env: childEnv({ VITE_API_BASE_URL: apiUrl }),
  });

  backendProcess = startLoggedService(
    process.execPath,
    ["--experimental-strip-types", "src/server.ts"],
    {
      cwd: join(root, "backend"),
      env: backendEnv(databaseUrl),
      logName: "backend.log",
    },
  );
  await waitFor(`${apiUrl}/api/v1/health`, "backend", backendProcess);

  frontendProcess = startLoggedService(
    join(root, "frontend/node_modules/.bin/vite"),
    ["preview", "--host", "127.0.0.1", "--port", new URL(baseUrl).port || "4173", "--strictPort"],
    {
      cwd: join(root, "frontend"),
      env: childEnv(),
      logName: "frontend.log",
    },
  );
  await waitFor(baseUrl, "frontend", frontendProcess);
}

async function resetControlState() {
  const response = await fetch(`${apiUrl}/api/v1/__e2e/reset`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-e2e-control-secret": controlSecret,
    },
    body: JSON.stringify({ users: [] }),
  });
  if (!response.ok) {
    throw new Error(`E2E reset failed with status ${response.status}`);
  }
}

async function stopChild(child) {
  if (!child || child.exitCode != null || child.signalCode != null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolvePromise) => child.once("exit", resolvePromise)),
    new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000)),
  ]);
  if (child.exitCode == null && child.signalCode == null) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolvePromise) => child.once("exit", resolvePromise)),
      new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000)),
    ]);
  }
}

async function cleanup() {
  await stopChild(frontendProcess);
  await stopChild(backendProcess);
  await Promise.all([...commandProcesses].map((child) => stopChild(child)));
  if (managedPostgres) {
    const pgBin = process.env.E2E_POSTGRES_BIN;
    const pgCtl = executable("pg_ctl", pgBin ? [join(pgBin, "pg_ctl")] : []);
    await run(pgCtl, ["-D", pgData, "-m", "fast", "-w", "stop"]);
    managedPostgres = false;
  }
}

const cleanupOnce = createOnceAsync(cleanup);
const finalizeE2ERun = createOnceAsync((runFailure) =>
  finalizeManagedArtifactRun({
    repositoryRoot: root,
    configuredArtifactRoot: artifactRoot,
    cleanup: cleanupOnce,
    needles: artifactCanaries(artifactDatabaseUrl),
    runFailure,
  }));

async function prepare({ keepServices = false } = {}) {
  const databaseUrl = await prepareDatabase();
  await buildAndStartServices(databaseUrl);
  await resetControlState();
  if (!keepServices) await cleanupOnce();
}

async function runPlaywright(extraArgs = []) {
  let runFailure;
  try {
    await resetManagedArtifacts(root, artifactRoot);
    const databaseUrl = await prepareDatabase();
    await buildAndStartServices(databaseUrl);
    await resetControlState();
    await run(join(root, "node_modules/.bin/playwright"), ["test", ...extraArgs], {
      env: childEnv(),
    });
  } catch (error) {
    runFailure = error;
  }
  await finalizeE2ERun(runFailure);
}

async function main() {
  if (command === "test") {
    await runPlaywright(process.argv.slice(3));
    return;
  }
  if (command === "live") {
    if (
      process.env.E2E_LIVE_AI !== "1" ||
      !process.env.YANDEX_AI_STUDIO_API_KEY ||
      !process.env.YANDEX_FOLDER_ID
    ) {
      throw new Error(
        "Live AI requires E2E_LIVE_AI=1, YANDEX_AI_STUDIO_API_KEY, and YANDEX_FOLDER_ID",
      );
    }
    await runPlaywright(["--project=live-ai-chromium", ...process.argv.slice(3)]);
    return;
  }
  if (command === "verify-artifacts") {
    await assertManagedArtifactsSafe(root, artifactRoot, artifactCanaries());
    return;
  }

  try {
    if (command === "install") {
      await mkdir(browserPath, { recursive: true });
      const installArgs = [
        "install",
        ...(process.env.CI || process.platform === "linux" ? ["--with-deps"] : []),
        "chromium",
        "webkit",
      ];
      await run(join(root, "node_modules/.bin/playwright"), installArgs, {
        env: childEnv(),
      });
      return;
    }
    if (command === "prepare") {
      await prepare();
      return;
    }
    if (command === "list") {
      await run(join(root, "node_modules/.bin/playwright"), ["test", "--list"], {
        env: childEnv(),
      });
      return;
    }
    throw new Error(`Unknown E2E command: ${command}`);
  } finally {
    await cleanupOnce();
  }
}

const shutdownForSignal = createSignalShutdown({
  finalize: finalizeE2ERun,
  reportError: (error) => {
    console.error(error instanceof Error ? error.message : error);
  },
  exit: (code) => process.exit(code),
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void shutdownForSignal(signal);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
