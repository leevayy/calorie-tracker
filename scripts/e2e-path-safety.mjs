import { lstatSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

function isInside(boundary, candidate) {
  return candidate === boundary || candidate.startsWith(`${boundary}${sep}`);
}

/**
 * Reject existing symbolic-link components below a trusted root before a
 * caller performs a recursive or otherwise destructive filesystem operation.
 */
export function assertNoSymlinkAncestry(
  trustedRoot,
  candidatePath,
  label = "Managed E2E path",
) {
  const root = resolve(trustedRoot);
  const candidate = resolve(candidatePath);
  if (!isInside(root, candidate)) {
    throw new Error(`${label} must stay under ${root}`);
  }

  const relativePath = relative(root, candidate);
  let current = root;
  for (const component of relativePath.split(sep).filter(Boolean)) {
    current = join(current, component);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (error?.code === "ENOENT") break;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`${label} must not contain symbolic-link path components`);
    }
  }
  return candidate;
}

export function assertManagedPostgresDataPath(repositoryRoot, candidatePath) {
  const root = resolve(repositoryRoot);
  const cacheRoot = resolve(root, ".cache");
  const candidate = resolve(candidatePath);
  if (candidate === cacheRoot || !candidate.startsWith(`${cacheRoot}${sep}`)) {
    throw new Error("Managed E2E PostgreSQL data must stay under the repository .cache directory");
  }
  return assertNoSymlinkAncestry(root, candidate, "Managed E2E PostgreSQL data");
}
