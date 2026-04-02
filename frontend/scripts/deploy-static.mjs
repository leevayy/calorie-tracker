import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Env: loaded by Node before this file runs — see package.json
 * `deploy:static` → `node --env-file=../.env …` (Node 20.6+). Requires repo-root `.env`.
 */
const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(frontendRoot, "dist");

/** AWS CLI expects AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY; map from Yandex static keys when unset. */
function applyYcS3CredentialsToAwsEnv() {
  if (!process.env.AWS_ACCESS_KEY_ID && process.env.YC_S3_API_KEY) {
    process.env.AWS_ACCESS_KEY_ID = process.env.YC_S3_API_KEY;
  }
  if (!process.env.AWS_SECRET_ACCESS_KEY && process.env.YC_S3_API_SECRET) {
    process.env.AWS_SECRET_ACCESS_KEY = process.env.YC_S3_API_SECRET;
  }
}

/**
 * Cursor / VS Code terminals often inherit a minimal PATH (no AWS CLI).
 * Prepend the folder that contains aws.exe so `aws` works under shell: true.
 */
function prependToWindowsPath(dir) {
  if (!dir || !existsSync(dir)) return;
  const sep = ";";
  const exe = join(dir, "aws.exe");
  if (!existsSync(exe)) return;
  const cur = process.env.Path || process.env.PATH || "";
  if (cur.toLowerCase().includes(dir.toLowerCase())) return;
  const next = `${dir}${sep}${cur}`;
  process.env.Path = next;
  process.env.PATH = next;
}

function awsFromEnv() {
  const p = process.env.AWS_CLI?.trim() || process.env.YC_AWS_CLI?.trim();
  return p || null;
}

function knownWindowsAwsExePaths() {
  const out = [];
  const pfRoots = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    "C:\\Program Files",
    "C:\\Program Files (x86)",
  ].filter(Boolean);
  for (const r of pfRoots) {
    out.push(join(r, "Amazon", "AWSCLIV2", "aws.exe"));
  }
  if (process.env.LOCALAPPDATA) {
    out.push(
      join(process.env.LOCALAPPDATA, "Programs", "Amazon", "AWSCLIV2", "aws.exe"),
    );
  }
  return out;
}

/** Last resort: full shell (same as external PowerShell) to resolve `aws` on PATH. */
function awsFromWhere() {
  if (process.platform !== "win32") return null;
  try {
    const out = execSync("where.exe aws", {
      encoding: "utf8",
      shell: true,
      windowsHide: true,
    }).trim();
    const line = out.split(/\r?\n/)[0]?.trim();
    if (line && existsSync(line)) return line;
  } catch {
    /* not on PATH in this process */
  }
  return null;
}

/**
 * Prefer a concrete aws.exe so Cursor’s stripped PATH does not matter.
 */
function resolveAwsCli() {
  const fromEnv = awsFromEnv();
  if (fromEnv) {
    return existsSync(fromEnv) ? fromEnv : fromEnv;
  }
  if (process.platform === "win32") {
    for (const exe of knownWindowsAwsExePaths()) {
      if (exe && existsSync(exe)) {
        prependToWindowsPath(dirname(exe));
        return exe;
      }
    }
    const where = awsFromWhere();
    if (where) return where;
  }
  return "aws";
}

applyYcS3CredentialsToAwsEnv();

const bucket =
  process.env.YC_S3_BUCKET?.trim() || process.env.S3_BUCKET?.trim();
const prefix = (process.env.YC_S3_PREFIX ?? process.env.S3_PREFIX ?? "").replace(
  /^\/+|\/+$/g,
  "",
);
const region =
  process.env.YC_S3_REGION?.trim() || process.env.AWS_REGION?.trim();
const endpoint =
  process.env.YC_S3_ENDPOINT?.trim() || process.env.S3_ENDPOINT?.trim();

if (!bucket) {
  console.error(
    "deploy:static: set YC_S3_BUCKET in .env at repo root (see .env.example) or in the environment.",
  );
  process.exit(1);
}

if (!endpoint) {
  console.error(
    "deploy:static: set YC_S3_ENDPOINT (e.g. https://storage.yandexcloud.net) for Yandex Object Storage.",
  );
  process.exit(1);
}

const destination = prefix ? `s3://${bucket}/${prefix}/` : `s3://${bucket}/`;

execSync("npm run build", { cwd: frontendRoot, stdio: "inherit" });

if (!existsSync(dist)) {
  console.error("deploy:static: dist/ missing after build.");
  process.exit(1);
}

/** No --delete: never remove remote objects (safe for shared buckets). Old hashed assets may linger — clean manually if needed. */
const awsArgs = ["--endpoint-url", endpoint, "s3", "sync", "dist/", destination];
if (region) {
  awsArgs.push("--region", region);
}

const awsCmd = resolveAwsCli();
const useShell =
  process.platform === "win32" &&
  awsCmd === "aws";

const result = spawnSync(awsCmd, awsArgs, {
  cwd: frontendRoot,
  stdio: "inherit",
  env: process.env,
  shell: useShell,
});

if (result.error) {
  console.error(result.error.message);
  console.error(
    "deploy:static: could not run AWS CLI. Install v2: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html",
  );
  console.error(
    "In Cursor: set AWS_CLI in repo-root .env to the full path of aws.exe, e.g. C:\\\\Program Files\\\\Amazon\\\\AWSCLIV2\\\\aws.exe",
  );
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    "deploy:static: `aws s3 sync` failed (see output above). Check YC_S3_* in repo-root .env.",
  );
  if (process.platform === "win32" && awsCmd === "aws") {
    console.error(
      'If you see "aws is not recognized", set AWS_CLI in .env to the full path to aws.exe.',
    );
  }
  process.exit(result.status ?? 1);
}

console.log(`deploy:static: uploaded to ${destination}`);
