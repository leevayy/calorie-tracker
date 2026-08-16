import { lstat, readdir, readFile, rm } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { yauzl } from "../node_modules/playwright-core/lib/utilsBundle.js";
import { assertNoSymlinkAncestry } from "./e2e-path-safety.mjs";

const REDACTED_ARTIFACT_DIRECTORY = "artifacts/playwright/redacted";
const MANAGED_ARTIFACT_NAMES = ["test-results", "html-report", "service-logs", "results.json"];
const PUBLIC_E2E_SESSION_PATTERN =
  /^e2e-public-session-v1:(?:access|refresh):[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:[A-Za-z0-9_-]+$/i;

const SENSITIVE_ENV_NAMES = [
  "JWT_SECRET",
  "E2E_CONTROL_SECRET",
  "E2E_TEST_EMAIL",
  "E2E_TEST_PASSWORD",
  "YANDEX_AI_STUDIO_API_KEY",
  "YANDEX_FOLDER_ID",
  "DATABASE_URL",
];

export function resolveManagedArtifactLayout(
  repositoryRoot,
  configuredArtifactRoot = REDACTED_ARTIFACT_DIRECTORY,
) {
  const redactedBoundary = resolve(repositoryRoot, REDACTED_ARTIFACT_DIRECTORY);
  const artifactRoot = resolve(repositoryRoot, configuredArtifactRoot);
  if (artifactRoot !== redactedBoundary && !artifactRoot.startsWith(`${redactedBoundary}${sep}`)) {
    throw new Error("E2E artifacts must stay under the ignored redacted artifact boundary");
  }
  assertNoSymlinkAncestry(repositoryRoot, artifactRoot, "E2E artifact root");
  return {
    artifactRoot,
    targets: MANAGED_ARTIFACT_NAMES.map((name) => join(artifactRoot, name)),
  };
}

export async function resetManagedArtifacts(repositoryRoot, configuredArtifactRoot) {
  const layout = resolveManagedArtifactLayout(repositoryRoot, configuredArtifactRoot);
  await Promise.all(layout.targets.map((target) => rm(target, { recursive: true, force: true })));
  return layout;
}

export function sensitiveArtifactValues(environment = process.env) {
  return SENSITIVE_ENV_NAMES.flatMap((name) => {
    const value = environment[name]?.trim();
    return value && value.length >= 8 ? [value] : [];
  });
}

function containsNeedle(buffer, needles) {
  return needles.some((needle) => buffer.includes(Buffer.from(needle)));
}

function isPublicE2ESessionHandle(value) {
  return PUBLIC_E2E_SESSION_PATTERN.test(value);
}

function containsCompactJwt(text) {
  const candidates = text.matchAll(
    /\b([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\b/g,
  );
  for (const candidate of candidates) {
    try {
      const header = JSON.parse(Buffer.from(candidate[1], "base64url").toString("utf8"));
      const payload = JSON.parse(Buffer.from(candidate[2], "base64url").toString("utf8"));
      if (header && typeof header === "object" && payload && typeof payload === "object") {
        return true;
      }
    } catch {
      // A dotted string that does not contain JSON JWT segments is not a token.
    }
  }
  return false;
}

function containsOpaqueToken(text) {
  const bearerTokens = text.matchAll(
    /\bauthorization\b[^\r\n]{0,80}\bbearer[ \t]+([A-Za-z0-9._~+:/=-]{8,})/giu,
  );
  for (const match of bearerTokens) {
    if (!isPublicE2ESessionHandle(match[1])) return true;
  }

  const storedTokens = text.matchAll(
    /\b(?:accessToken|refreshToken|access_token|refresh_token)\b[^A-Za-z0-9\r\n]{0,32}([A-Za-z0-9._~+:/=-]{8,})/giu,
  );
  for (const match of storedTokens) {
    if (!isPublicE2ESessionHandle(match[1])) return true;
  }
  return false;
}

function containsSensitiveContent(buffer, needles) {
  if (containsNeedle(buffer, needles)) return true;
  const text = buffer.toString("utf8");
  return containsCompactJwt(text) || containsOpaqueToken(text);
}

async function listArtifacts(root) {
  let rootStat;
  try {
    rootStat = await lstat(root);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  if (rootStat.isFile()) return [{ inspectable: true, pathname: root }];
  if (!rootStat.isDirectory()) return [{ inspectable: false, pathname: root }];
  const artifacts = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const pathname = join(root, entry.name);
    if (entry.isDirectory()) artifacts.push(...await listArtifacts(pathname));
    else artifacts.push({ inspectable: entry.isFile(), pathname });
  }
  return artifacts;
}

async function zipContainsNeedle(pathname, needles) {
  return new Promise((resolve, reject) => {
    yauzl.open(pathname, { lazyEntries: true }, (openError, zip) => {
      if (openError || !zip) {
        reject(openError ?? new Error(`Could not inspect ${pathname}`));
        return;
      }

      let settled = false;
      const close = () => {
        try {
          zip.close();
        } catch {
          // The archive may already have closed while reporting its error.
        }
      };
      const finish = (value) => {
        if (settled) return;
        settled = true;
        close();
        resolve(value);
      };
      const fail = (error) => {
        if (settled) return;
        settled = true;
        close();
        reject(error);
      };
      zip.once("error", fail);
      zip.once("end", () => finish(false));
      zip.on("entry", (entry) => {
        if (containsSensitiveContent(Buffer.from(entry.fileName), needles)) {
          finish(true);
          return;
        }
        if (entry.fileName.endsWith("/")) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            fail(streamError ?? new Error(`Could not inspect ${entry.fileName}`));
            return;
          }
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.once("error", fail);
          stream.once("end", () => {
            if (settled) return;
            if (containsSensitiveContent(Buffer.concat(chunks), needles)) finish(true);
            else zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

export async function quarantineSensitiveArtifacts(root, needles = sensitiveArtifactValues()) {
  const quarantined = [];
  for (const artifact of await listArtifacts(root)) {
    const relativePath = relative(root, artifact.pathname) || basename(artifact.pathname);
    let unsafe =
      !artifact.inspectable ||
      containsSensitiveContent(Buffer.from(relativePath), needles);
    if (artifact.inspectable) {
      try {
        const contents = await readFile(artifact.pathname);
        unsafe = unsafe || containsSensitiveContent(contents, needles);
        if (!unsafe && artifact.pathname.toLowerCase().endsWith(".zip")) {
          unsafe = await zipContainsNeedle(artifact.pathname, needles);
        }
      } catch {
        // An artifact that cannot be completely inspected is not safe to retain.
        unsafe = true;
      }
    }
    if (!unsafe) continue;
    await rm(artifact.pathname, { force: true });
    quarantined.push(artifact.pathname);
  }
  return { quarantined };
}

export async function verifyManagedArtifacts(
  repositoryRoot,
  configuredArtifactRoot,
  needles = sensitiveArtifactValues(),
) {
  const layout = resolveManagedArtifactLayout(repositoryRoot, configuredArtifactRoot);
  const quarantined = [];
  for (const target of layout.targets) {
    const result = await quarantineSensitiveArtifacts(target, needles);
    quarantined.push(...result.quarantined);
  }
  return { ...layout, quarantined };
}

export async function assertManagedArtifactsSafe(
  repositoryRoot,
  configuredArtifactRoot,
  needles = sensitiveArtifactValues(),
) {
  const result = await verifyManagedArtifacts(repositoryRoot, configuredArtifactRoot, needles);
  if (result.quarantined.length > 0) {
    throw new Error(
      `E2E artifact verification quarantined ${result.quarantined.length} unsafe file(s)`,
    );
  }
  return result;
}

export async function finalizeManagedArtifactRun({
  repositoryRoot,
  configuredArtifactRoot,
  cleanup,
  needles = sensitiveArtifactValues(),
  runFailure,
}) {
  const failures = runFailure ? [runFailure] : [];
  try {
    await cleanup();
  } catch (error) {
    failures.push(error);
  }
  try {
    await assertManagedArtifactsSafe(repositoryRoot, configuredArtifactRoot, needles);
  } catch (error) {
    failures.push(error);
  }

  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, "E2E run, cleanup, or artifact verification failed");
  }
}
