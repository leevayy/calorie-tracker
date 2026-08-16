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
import { createOnceAsync, createSignalShutdown } from "./e2e-lifecycle.mjs";
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
