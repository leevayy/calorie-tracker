import { createReadStream } from "node:fs";
import { lstat, readdir, rm } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { yauzl } from "../node_modules/playwright-core/lib/utilsBundle.js";
import { assertNoSymlinkAncestry } from "./e2e-path-safety.mjs";

const REDACTED_ARTIFACT_DIRECTORY = "artifacts/playwright/redacted";
const MANAGED_ARTIFACT_NAMES = ["test-results", "html-report", "service-logs", "results.json"];
const PUBLIC_E2E_SESSION_PATTERN =
  /^e2e-public-session-v1:(?:access|refresh):[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:[A-Za-z0-9_-]+$/i;
const DEFAULT_READ_CHUNK_BYTES = 64 * 1024;
const MAX_READ_CHUNK_BYTES = 1024 * 1024;
const MAX_TOKEN_COMPONENT_BYTES = 32 * 1024;
const TOKEN_SCAN_OVERLAP_BYTES = 3 * MAX_TOKEN_COMPONENT_BYTES + 2;
const DEFAULT_MAX_ZIP_ENTRY_BYTES = 256 * 1024 * 1024;
const DEFAULT_MAX_ZIP_TOTAL_BYTES = 1024 * 1024 * 1024;
const DEFAULT_MAX_ZIP_ENTRIES = 10_000;
const DEFAULT_MAX_ZIP_COMPRESSION_RATIO = 1_000;

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

function buildPrefixTable(pattern) {
  const prefix = new Uint32Array(pattern.length);
  let matched = 0;
  for (let index = 1; index < pattern.length; index += 1) {
    while (matched > 0 && pattern[index] !== pattern[matched]) {
      matched = prefix[matched - 1];
    }
    if (pattern[index] === pattern[matched]) matched += 1;
    prefix[index] = matched;
  }
  return prefix;
}

function createStreamingNeedleMatcher(needles) {
  const patterns = needles
    .map((needle) => Buffer.from(needle))
    .filter((pattern) => pattern.length > 0)
    .map((pattern) => ({ pattern, prefix: buildPrefixTable(pattern), matched: 0 }));

  return (chunk) => {
    for (const state of patterns) {
      for (const byte of chunk) {
        while (state.matched > 0 && byte !== state.pattern[state.matched]) {
          state.matched = state.prefix[state.matched - 1];
        }
        if (byte === state.pattern[state.matched]) state.matched += 1;
        if (state.matched === state.pattern.length) return true;
      }
    }
    return false;
  };
}

function isPublicE2ESessionHandle(value) {
  return PUBLIC_E2E_SESSION_PATTERN.test(value);
}

function isBase64UrlCharacter(character) {
  if (!character) return false;
  const code = character.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    code === 95 ||
    (code >= 97 && code <= 122) ||
    code === 45
  );
}

function base64UrlSegmentEnd(text, start) {
  let end = start;
  while (end < text.length && isBase64UrlCharacter(text[end])) end += 1;
  return end;
}

function containsCompactJwt(text) {
  let index = 0;
  while (index < text.length) {
    if (
      !isBase64UrlCharacter(text[index]) ||
      (index > 0 && isBase64UrlCharacter(text[index - 1]))
    ) {
      index += 1;
      continue;
    }

    const firstEnd = base64UrlSegmentEnd(text, index);
    if (firstEnd - index < 8 || text[firstEnd] !== ".") {
      index = firstEnd + 1;
      continue;
    }
    const secondStart = firstEnd + 1;
    const secondEnd = base64UrlSegmentEnd(text, secondStart);
    if (secondEnd - secondStart < 8 || text[secondEnd] !== ".") {
      index = secondEnd + 1;
      continue;
    }
    const thirdStart = secondEnd + 1;
    const thirdEnd = base64UrlSegmentEnd(text, thirdStart);
    if (thirdEnd - thirdStart < 8) {
      index = thirdEnd + 1;
      continue;
    }

    const componentLengths = [
      firstEnd - index,
      secondEnd - secondStart,
      thirdEnd - thirdStart,
    ];
    // Do not let adversarial token-shaped text defeat bounded overlap. A token
    // component too large to inspect is unsafe rather than silently skipped.
    if (componentLengths.some((length) => length > MAX_TOKEN_COMPONENT_BYTES)) return true;

    try {
      const header = JSON.parse(
        Buffer.from(text.slice(index, firstEnd), "base64url").toString("utf8"),
      );
      const payload = JSON.parse(
        Buffer.from(text.slice(secondStart, secondEnd), "base64url").toString("utf8"),
      );
      if (header && typeof header === "object" && payload && typeof payload === "object") {
        return true;
      }
    } catch {
      // A dotted string that does not contain JSON JWT segments is not a token.
    }
    index = thirdEnd + 1;
  }
  return false;
}

function containsOversizedDottedTokenComponent(text) {
  let index = 0;
  while (index < text.length) {
    if (!isBase64UrlCharacter(text[index])) {
      index += 1;
      continue;
    }
    const start = index;
    index = base64UrlSegmentEnd(text, start);
    if (
      index - start > MAX_TOKEN_COMPONENT_BYTES &&
      (text[start - 1] === "." || text[index] === ".")
    ) {
      return true;
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
  return (
    containsCompactJwt(text) ||
    containsOpaqueToken(text) ||
    containsOversizedDottedTokenComponent(text)
  );
}

function boundedPositiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, maximum) : fallback;
}

function inspectionOptions(options = {}) {
  return {
    readChunkBytes: boundedPositiveInteger(
      options.readChunkBytes,
      DEFAULT_READ_CHUNK_BYTES,
      MAX_READ_CHUNK_BYTES,
    ),
    maxZipEntryBytes: boundedPositiveInteger(
      options.maxZipEntryBytes,
      DEFAULT_MAX_ZIP_ENTRY_BYTES,
    ),
    maxZipTotalBytes: boundedPositiveInteger(
      options.maxZipTotalBytes,
      DEFAULT_MAX_ZIP_TOTAL_BYTES,
    ),
    maxZipEntries: boundedPositiveInteger(options.maxZipEntries, DEFAULT_MAX_ZIP_ENTRIES),
    maxZipCompressionRatio: boundedPositiveInteger(
      options.maxZipCompressionRatio,
      DEFAULT_MAX_ZIP_COMPRESSION_RATIO,
    ),
    observeReadChunk:
      typeof options.observeReadChunk === "function" ? options.observeReadChunk : () => {},
  };
}

async function readableContainsSensitiveContent(readable, needles, options, maxBytes = Infinity) {
  const matchNeedle = createStreamingNeedleMatcher(needles);
  let textTail = Buffer.alloc(0);
  let bytesRead = 0;

  for await (const value of readable) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    options.observeReadChunk(chunk.length);
    bytesRead += chunk.length;
    if (bytesRead > maxBytes) {
      throw new Error("Artifact stream exceeded its bounded inspection limit");
    }
    if (matchNeedle(chunk)) return true;

    const textWindow =
      textTail.length === 0 ? chunk : Buffer.concat([textTail, chunk]);
    const text = textWindow.toString("utf8");
    if (
      containsCompactJwt(text) ||
      containsOpaqueToken(text) ||
      containsOversizedDottedTokenComponent(text)
    ) {
      return true;
    }
    textTail = Buffer.from(textWindow.subarray(-TOKEN_SCAN_OVERLAP_BYTES));
  }
  return false;
}

async function fileContainsSensitiveContent(pathname, needles, options) {
  const stream = createReadStream(pathname, { highWaterMark: options.readChunkBytes });
  return readableContainsSensitiveContent(stream, needles, options);
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

async function zipContainsNeedle(pathname, needles, options) {
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
      let entryCount = 0;
      let totalUncompressedBytes = 0;
      zip.on("entry", (entry) => {
        entryCount += 1;
        totalUncompressedBytes += entry.uncompressedSize;
        if (containsSensitiveContent(Buffer.from(entry.fileName), needles)) {
          finish(true);
          return;
        }
        const compressionRatio =
          entry.compressedSize === 0
            ? entry.uncompressedSize === 0
              ? 1
              : Infinity
            : entry.uncompressedSize / entry.compressedSize;
        if (
          entryCount > options.maxZipEntries ||
          entry.uncompressedSize > options.maxZipEntryBytes ||
          totalUncompressedBytes > options.maxZipTotalBytes ||
          compressionRatio > options.maxZipCompressionRatio
        ) {
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
          readableContainsSensitiveContent(
            stream,
            needles,
            options,
            options.maxZipEntryBytes,
          ).then(
            (unsafe) => {
              if (settled) return;
              if (unsafe) finish(true);
              else zip.readEntry();
            },
            fail,
          );
        });
      });
      zip.readEntry();
    });
  });
}

export async function quarantineSensitiveArtifacts(
  root,
  needles = sensitiveArtifactValues(),
  configuredOptions,
) {
  const options = inspectionOptions(configuredOptions);
  const quarantined = [];
  for (const artifact of await listArtifacts(root)) {
    const relativePath = relative(root, artifact.pathname) || basename(artifact.pathname);
    let unsafe =
      !artifact.inspectable ||
      containsSensitiveContent(Buffer.from(relativePath), needles);
    if (artifact.inspectable) {
      try {
        unsafe = unsafe || await fileContainsSensitiveContent(artifact.pathname, needles, options);
        if (!unsafe && artifact.pathname.toLowerCase().endsWith(".zip")) {
          unsafe = await zipContainsNeedle(artifact.pathname, needles, options);
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
