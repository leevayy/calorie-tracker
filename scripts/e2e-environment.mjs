import { createHash, randomBytes } from "node:crypto";

export const PUBLIC_E2E_CONTROL_HANDLE = "e2e-public-control-v1";
export const PUBLIC_E2E_TEST_EMAIL = "playwright@example.invalid";
export const PUBLIC_E2E_TEST_PASSWORD = "playwright-local-only-password";

const BROWSER_ENVIRONMENT_NAMES = new Set([
  "PATH",
  "HOME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TZ",
  "CI",
  "TERM",
  "COLORTERM",
  "PLAYWRIGHT_BROWSERS_PATH",
  "E2E_ARTIFACT_DIR",
  "E2E_BASE_URL",
  "E2E_API_URL",
  "E2E_LIVE_AI",
  "VITE_API_BASE_URL",
  "XDG_RUNTIME_DIR",
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  "DISPLAY",
  "WAYLAND_DISPLAY",
  "DBUS_SESSION_BUS_ADDRESS",
]);
const INSTALL_NETWORK_ENVIRONMENT_NAMES = new Set([
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "NODE_EXTRA_CA_CERTS",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
]);
const PUBLIC_BROWSER_VALUES = new Set([
  PUBLIC_E2E_CONTROL_HANDLE,
  PUBLIC_E2E_TEST_EMAIL,
  PUBLIC_E2E_TEST_PASSWORD,
]);

function guardedValueHash(salt, value) {
  return createHash("sha256").update(salt).update("\0").update(value).digest("hex");
}

/**
 * Build the allowlisted environment inherited by Playwright workers and their
 * browser processes. Real configured credentials remain available only to the
 * backend; browser journeys receive documented disposable public E2E values.
 */
export function createBrowserTestEnvironment(
  environment,
  { allowInstallNetworkConfiguration = false } = {},
) {
  const browserEnvironment = {};
  const forbiddenValues = [];
  for (const [name, value] of Object.entries(environment)) {
    if (value == null) continue;
    if (
      BROWSER_ENVIRONMENT_NAMES.has(name) ||
      (allowInstallNetworkConfiguration && INSTALL_NETWORK_ENVIRONMENT_NAMES.has(name))
    ) {
      browserEnvironment[name] = value;
    } else if (value.length >= 8 && !PUBLIC_BROWSER_VALUES.has(value)) {
      // Only a salted one-way guard reaches the worker. Browser-facing helpers
      // can reject an attempted exact value without receiving the value itself.
      forbiddenValues.push(value);
    }
  }
  const guardSalt = randomBytes(16).toString("hex");
  return {
    ...browserEnvironment,
    E2E_CONTROL_SECRET: PUBLIC_E2E_CONTROL_HANDLE,
    E2E_TEST_EMAIL: PUBLIC_E2E_TEST_EMAIL,
    E2E_TEST_PASSWORD: PUBLIC_E2E_TEST_PASSWORD,
    E2E_BROWSER_GUARD_SALT: guardSalt,
    E2E_BROWSER_FORBIDDEN_VALUE_HASHES: JSON.stringify(
      [...new Set(forbiddenValues.map((value) => guardedValueHash(guardSalt, value)))],
    ),
  };
}
