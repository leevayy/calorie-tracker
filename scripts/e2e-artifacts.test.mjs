import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { yazl } from "../node_modules/playwright-core/lib/utilsBundle.js";
import {
  finalizeManagedArtifactRun,
  quarantineSensitiveArtifacts,
  resetManagedArtifacts,
  resolveManagedArtifactLayout,
  sensitiveArtifactValues,
} from "./e2e-artifacts.mjs";
import {
  createManagedResourceLifecycle,
  createOnceAsync,
  createSignalShutdown,
} from "./e2e-lifecycle.mjs";
import {
  assertManagedPostgresDataPath,
  assertNoSymlinkAncestry,
} from "./e2e-path-safety.mjs";

async function writeZip(pathname, entries) {
  const zip = new yazl.ZipFile();
  for (const [name, contents] of Object.entries(entries)) {
    zip.addBuffer(Buffer.from(contents), name);
  }
  zip.end();
  const chunks = [];
  for await (const chunk of zip.outputStream) chunks.push(chunk);
  await writeFile(pathname, Buffer.concat(chunks));
}

test("resolves only the managed targets under the ignored redacted boundary", async () => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "calorie-e2e-repository-"));
  const artifactRoot = join(repositoryRoot, "artifacts/playwright/redacted/run-1");

  assert.deepEqual(resolveManagedArtifactLayout(repositoryRoot, artifactRoot), {
    artifactRoot,
    targets: [
      join(artifactRoot, "test-results"),
      join(artifactRoot, "html-report"),
      join(artifactRoot, "service-logs"),
      join(artifactRoot, "results.json"),
    ],
  });
  assert.throws(
    () => resolveManagedArtifactLayout(repositoryRoot, join(repositoryRoot, "artifacts/playwright/raw")),
    /must stay under the ignored redacted artifact boundary/,
  );
  assert.throws(
    () => resolveManagedArtifactLayout(repositoryRoot, join(repositoryRoot, "..", "outside")),
    /must stay under the ignored redacted artifact boundary/,
  );
});

test("rejects symbolic-link ancestry before artifact or PostgreSQL cleanup", async () => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "calorie-e2e-repository-"));
  const external = await mkdtemp(join(tmpdir(), "calorie-e2e-external-"));
  const externalSentinel = join(external, "keep-me.txt");
  await writeFile(externalSentinel, "must survive");

  const artifactBoundary = join(repositoryRoot, "artifacts/playwright/redacted");
  await mkdir(artifactBoundary, { recursive: true });
  const linkedArtifactRoot = join(artifactBoundary, "linked-run");
  await symlink(external, linkedArtifactRoot);
  assert.throws(
    () => resolveManagedArtifactLayout(repositoryRoot, linkedArtifactRoot),
    /must not contain symbolic-link path components/,
  );

  const cacheRoot = join(repositoryRoot, ".cache");
  await mkdir(cacheRoot, { recursive: true });
  const linkedCacheChild = join(cacheRoot, "linked-cluster-parent");
  await symlink(external, linkedCacheChild);
  assert.throws(
    () => assertManagedPostgresDataPath(repositoryRoot, join(linkedCacheChild, "cluster")),
    /must not contain symbolic-link path components/,
  );
  assert.throws(
    () => assertNoSymlinkAncestry(repositoryRoot, join(linkedCacheChild, "cluster")),
    /must not contain symbolic-link path components/,
  );
  assert.equal(await readFile(externalSentinel, "utf8"), "must survive");
});

test("resets every managed result target without deleting artifact-root siblings", async () => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "calorie-e2e-repository-"));
  const { artifactRoot, targets } = resolveManagedArtifactLayout(repositoryRoot);
  const [testResults, htmlReport, serviceLogs, resultsJson] = targets;
  const staleVideo = join(testResults, "desktop", "result", "video.webm");
  const unmanagedSibling = join(artifactRoot, "keep-me.txt");
  await mkdir(join(staleVideo, ".."), { recursive: true });
  await mkdir(htmlReport, { recursive: true });
  await mkdir(serviceLogs, { recursive: true });
  await writeFile(staleVideo, "stale video");
  await writeFile(join(htmlReport, "index.html"), "stale report");
  await writeFile(join(serviceLogs, "backend.log"), "stale log");
  await writeFile(resultsJson, "stale results");
  await writeFile(unmanagedSibling, "not managed by the runner");

  await resetManagedArtifacts(repositoryRoot);

  for (const target of targets) await assert.rejects(readFile(target), { code: "ENOENT" });
  assert.equal(await readFile(unmanagedSibling, "utf8"), "not managed by the runner");
});

test("scans and removes unsafe managed output despite test and cleanup failures", async () => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "calorie-e2e-repository-"));
  const { artifactRoot, targets } = resolveManagedArtifactLayout(repositoryRoot);
  const unsafeResult = join(targets[0], "desktop", "result", "failure.txt");
  const unmanagedSibling = join(artifactRoot, "not-uploaded.txt");
  await mkdir(join(unsafeResult, ".."), { recursive: true });
  await writeFile(unsafeResult, "credential-canary-123");
  await writeFile(unmanagedSibling, "credential-canary-123");
  const testFailure = new Error("Playwright failed");
  const cleanupFailure = new Error("service cleanup failed");

  await assert.rejects(
    finalizeManagedArtifactRun({
      repositoryRoot,
      cleanup: async () => {
        throw cleanupFailure;
      },
      needles: ["credential-canary-123"],
      runFailure: testFailure,
    }),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.ok(error.errors.includes(testFailure));
      assert.ok(error.errors.includes(cleanupFailure));
      assert.ok(error.errors.some((failure) => /artifact verification quarantined/.test(failure.message)));
      return true;
    },
  );
  await assert.rejects(readFile(unsafeResult), { code: "ENOENT" });
  assert.equal(await readFile(unmanagedSibling, "utf8"), "credential-canary-123");
});

test("derives only nontrivial configured credential canaries", () => {
  assert.deepEqual(
    sensitiveArtifactValues({
      JWT_SECRET: "jwt-secret-at-least-sixteen",
      E2E_CONTROL_SECRET: "control-secret-at-least-sixteen",
      E2E_TEST_EMAIL: "playwright@example.invalid",
      E2E_TEST_PASSWORD: "test-password-at-least-eight",
      YANDEX_AI_STUDIO_API_KEY: "provider-secret-at-least-eight",
      YANDEX_FOLDER_ID: "provider-folder-id",
      DATABASE_URL: "postgresql://user:password@localhost/calorie_tracker_e2e",
      PATH: "/usr/bin",
      SHORT: "tiny",
    }),
    [
      "jwt-secret-at-least-sixteen",
      "control-secret-at-least-sixteen",
      "playwright@example.invalid",
      "test-password-at-least-eight",
      "provider-secret-at-least-eight",
      "provider-folder-id",
      "postgresql://user:password@localhost/calorie_tracker_e2e",
    ],
  );
});

test("quarantines plain and compressed artifacts containing a credential", async () => {
  const root = await mkdtemp(join(tmpdir(), "calorie-e2e-artifacts-"));
  const safe = join(root, "safe.log");
  const unsafe = join(root, "unsafe.json");
  const trace = join(root, "trace.zip");
  await mkdir(join(root, "nested"));
  await writeFile(safe, "ordinary synthetic output");
  await writeFile(unsafe, '{"password":"credential-canary-123"}');
  await writeZip(trace, {
    "trace.network": "Authorization: Bearer credential-canary-123",
  });

  const result = await quarantineSensitiveArtifacts(root, ["credential-canary-123"]);

  assert.deepEqual(result.quarantined.map((path) => path.split("/").at(-1)).sort(), [
    "trace.zip",
    "unsafe.json",
  ]);
  assert.equal(await readFile(safe, "utf8"), "ordinary synthetic output");
  await assert.rejects(readFile(unsafe), { code: "ENOENT" });
  await assert.rejects(readFile(trace), { code: "ENOENT" });
});

test("streams large artifact files in bounded chunks and matches across chunk boundaries", async () => {
  const root = await mkdtemp(join(tmpdir(), "calorie-e2e-artifacts-"));
  const safe = join(root, "large-safe.webm");
  const unsafe = join(root, "large-unsafe.webm");
  const canary = "credential-canary-crossing-a-boundary";
  const prefix = Buffer.alloc(4_095, "a");
  await writeFile(safe, Buffer.alloc(256 * 1024, 0x5a));
  await writeFile(
    unsafe,
    Buffer.concat([prefix, Buffer.from(canary), Buffer.alloc(256 * 1024, "b")]),
  );
  const observedChunks = [];

  const result = await quarantineSensitiveArtifacts(root, [canary], {
    readChunkBytes: 4_096,
    observeReadChunk: (size) => observedChunks.push(size),
  });

  assert.deepEqual(result.quarantined, [unsafe]);
  assert.ok(observedChunks.length > 2);
  assert.ok(observedChunks.every((size) => size <= 4_096));
  assert.equal((await readFile(safe)).byteLength, 256 * 1024);
});

test("detects a derived JWT that spans many small streaming chunks", async () => {
  const root = await mkdtemp(join(tmpdir(), "calorie-e2e-artifacts-"));
  const tokenArtifact = join(root, "large-derived-token.log");
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", padding: "h".repeat(24_548) }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ sub: "x", padding: "p".repeat(24_548) }),
  ).toString("base64url");
  const jwt = `${header}.${payload}.${"s".repeat(20_000)}`;
  assert.ok(header.length <= 32 * 1024);
  assert.ok(payload.length <= 32 * 1024);
  assert.ok(header.length + payload.length + 2 + 8 > 64 * 1024);
  await writeFile(tokenArtifact, `prefix:${jwt}:suffix`);

  const result = await quarantineSensitiveArtifacts(root, [], {
    readChunkBytes: 4_096,
  });

  assert.deepEqual(result.quarantined, [tokenArtifact]);
  await assert.rejects(readFile(tokenArtifact), { code: "ENOENT" });
});

test("fails closed on an oversized dotted token component without buffering it whole", async () => {
  const root = await mkdtemp(join(tmpdir(), "calorie-e2e-artifacts-"));
  const tokenArtifact = join(root, "oversized-token.log");
  await writeFile(
    tokenArtifact,
    `headerpart.${"a".repeat(256 * 1024)}.signaturepart`,
  );

  const result = await quarantineSensitiveArtifacts(root, [], {
    readChunkBytes: 4_096,
  });

  assert.deepEqual(result.quarantined, [tokenArtifact]);
  await assert.rejects(readFile(tokenArtifact), { code: "ENOENT" });
});

test("quarantines a ZIP whose declared entry exceeds the bounded inspection policy", async () => {
  const root = await mkdtemp(join(tmpdir(), "calorie-e2e-artifacts-"));
  const oversizedTrace = join(root, "oversized-trace.zip");
  await writeZip(oversizedTrace, {
    "trace.network": "ordinary synthetic trace data".repeat(128),
  });

  const result = await quarantineSensitiveArtifacts(root, [], {
    maxZipEntryBytes: 1_024,
  });

  assert.deepEqual(result.quarantined, [oversizedTrace]);
  await assert.rejects(readFile(oversizedTrace), { code: "ENOENT" });
});

test("quarantines credentials in relative paths and ZIP entry names", async () => {
  const root = await mkdtemp(join(tmpdir(), "calorie-e2e-artifacts-"));
  const credentialDirectory = join(root, "credential-canary-123");
  const namedArtifact = join(credentialDirectory, "video.webm");
  const trace = join(root, "trace.zip");
  await mkdir(credentialDirectory);
  await writeFile(namedArtifact, "otherwise safe video bytes");
  await writeZip(trace, {
    "attachments/credential-canary-123.txt": "otherwise safe attachment",
  });

  const result = await quarantineSensitiveArtifacts(root, ["credential-canary-123"]);

  assert.deepEqual(result.quarantined.sort(), [namedArtifact, trace].sort());
  await assert.rejects(readFile(namedArtifact), { code: "ENOENT" });
  await assert.rejects(readFile(trace), { code: "ENOENT" });
});

test("quarantines derived and opaque tokens while preserving public E2E handles", async () => {
  const root = await mkdtemp(join(tmpdir(), "calorie-e2e-artifacts-"));
  const jwt = join(root, "jwt.log");
  const bearer = join(root, "bearer.json");
  const storedTokens = join(root, "storage.json");
  const trace = join(root, "trace.zip");
  const publicHandle = join(root, "public-session.log");
  const spoofedPublicHandle = join(root, "spoofed-public-session.log");
  await writeFile(
    jwt,
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJleHAiOjk5OTk5OTk5OTl9.c2lnbmF0dXJlLXdpdGgtZW5vdWdoLWxlbmd0aA",
  );
  await writeFile(
    bearer,
    '{"name":"Authorization","value":"Bearer opaque-access-token-123456789"}',
  );
  await writeFile(
    storedTokens,
    '{"accessToken":"opaque-access-123456789","refresh_token":"opaque-refresh-123456789"}',
  );
  await writeZip(trace, {
    "trace.storage": '{"refreshToken":"compressed-refresh-123456789"}',
  });
  await writeFile(
    publicHandle,
    '{"accessToken":"e2e-public-session-v1:access:11111111-1111-4111-8111-111111111111:cGxheXdyaWdodEBleGFtcGxlLmludmFsaWQ","refreshToken":"e2e-public-session-v1:refresh:11111111-1111-4111-8111-111111111111:cGxheXdyaWdodEBleGFtcGxlLmludmFsaWQ","headers":{"Authorization":"Bearer e2e-public-session-v1:access:11111111-1111-4111-8111-111111111111:cGxheXdyaWdodEBleGFtcGxlLmludmFsaWQ"}}',
  );
  await writeFile(
    spoofedPublicHandle,
    '{"Authorization":"Bearer e2e-public-session-v1:not-a-valid-public-handle"}',
  );

  const result = await quarantineSensitiveArtifacts(root, []);

  assert.deepEqual(result.quarantined.map((path) => path.split("/").at(-1)).sort(), [
    "bearer.json",
    "jwt.log",
    "spoofed-public-session.log",
    "storage.json",
    "trace.zip",
  ]);
  assert.match(await readFile(publicHandle, "utf8"), /e2e-public-session-v1/);
});

test("quarantines an unreadable trace archive instead of leaving it uploadable", async () => {
  const root = await mkdtemp(join(tmpdir(), "calorie-e2e-artifacts-"));
  const trace = join(root, "trace.zip");
  await writeFile(trace, "this is not a readable zip archive");

  const result = await quarantineSensitiveArtifacts(root, []);

  assert.deepEqual(result.quarantined, [trace]);
  await assert.rejects(readFile(trace), { code: "ENOENT" });
});

test("quarantines symlinks without inspecting or deleting their external targets", async () => {
  const root = await mkdtemp(join(tmpdir(), "calorie-e2e-artifacts-"));
  const external = join(await mkdtemp(join(tmpdir(), "calorie-e2e-external-")), "secret.txt");
  const linkedArtifact = join(root, "linked.log");
  await writeFile(external, "credential-canary-123");
  await symlink(external, linkedArtifact);

  const result = await quarantineSensitiveArtifacts(root, ["credential-canary-123"]);

  assert.deepEqual(result.quarantined, [linkedArtifact]);
  await assert.rejects(readFile(linkedArtifact), { code: "ENOENT" });
  assert.equal(await readFile(external, "utf8"), "credential-canary-123");
});

test("signal shutdown shares one cleanup and verification finalizer", async () => {
  let cleanupCalls = 0;
  let verificationCalls = 0;
  let releaseFinalization;
  const finalizationGate = new Promise((resolvePromise) => {
    releaseFinalization = resolvePromise;
  });
  const finalizeOnce = createOnceAsync(async () => {
    cleanupCalls += 1;
    await finalizationGate;
    verificationCalls += 1;
  });
  const exits = [];
  const errors = [];
  const shutdown = createSignalShutdown({
    finalize: finalizeOnce,
    reportError: (error) => errors.push(error),
    exit: (code) => exits.push(code),
  });

  const normalFinalization = finalizeOnce();
  const interruptedFinalization = shutdown("SIGTERM");
  const repeatedSignal = shutdown("SIGINT");
  releaseFinalization();
  await Promise.all([normalFinalization, interruptedFinalization, repeatedSignal]);

  assert.equal(cleanupCalls, 1);
  assert.equal(verificationCalls, 1);
  assert.deepEqual(errors, []);
  assert.deepEqual(exits, [143]);
});

test("managed resource cleanup remains owned while its start command is interrupted", async () => {
  let releaseStart;
  const startGate = new Promise((_, reject) => {
    releaseStart = () => reject(new Error("start command interrupted"));
  });
  let stopCalls = 0;
  const lifecycle = createManagedResourceLifecycle({
    stop: async () => {
      stopCalls += 1;
    },
  });

  const starting = lifecycle.start(() => startGate);
  const startFailure = assert.rejects(starting, /start command interrupted/);
  const stopping = lifecycle.stop();
  await new Promise((resolvePromise) => setImmediate(resolvePromise));
  assert.equal(stopCalls, 0, "cleanup waits for the in-flight start command to settle");

  releaseStart();
  await Promise.all([startFailure, stopping]);
  assert.equal(stopCalls, 1, "cleanup still stops a resource claimed before start completed");
  await lifecycle.start(async () => {});
  await lifecycle.stop();
  assert.equal(stopCalls, 2, "a successfully stopped lifecycle can own a later cycle");
});

test("managed resource ownership survives a failed stop and permits a cleanup retry", async () => {
  let stopCalls = 0;
  const lifecycle = createManagedResourceLifecycle({
    stop: async () => {
      stopCalls += 1;
      if (stopCalls === 1) throw new Error("stop failed");
    },
  });

  await lifecycle.start(async () => {});
  await assert.rejects(lifecycle.stop(), /stop failed/);
  assert.throws(
    () => lifecycle.start(async () => {}),
    /Managed resource has already been claimed/,
  );
  await lifecycle.stop();
  assert.equal(stopCalls, 2);

  await lifecycle.start(async () => {});
  await lifecycle.stop();
  assert.equal(stopCalls, 3);
});
