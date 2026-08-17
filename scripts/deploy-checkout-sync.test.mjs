import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const syncScript = new URL("./deploy-checkout-sync.sh", import.meta.url).pathname;
const deployWorkflow = new URL("../.github/workflows/deploy.yml", import.meta.url).pathname;

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function configureAuthor(cwd) {
  git(cwd, "config", "user.name", "Deploy fixture");
  git(cwd, "config", "user.email", "deploy-fixture@example.invalid");
}

test("reconciles a dirty divergent VM checkout without losing server-only work", () => {
  const root = mkdtempSync(join(tmpdir(), "calorie-deploy-sync-"));
  const remote = join(root, "remote.git");
  const source = join(root, "source");
  const deploy = join(root, "deploy");

  try {
    git(root, "init", "--bare", remote);
    git(root, "clone", remote, source);
    configureAuthor(source);
    writeFileSync(join(source, ".gitignore"), ".env\n");
    writeFileSync(join(source, "package-lock.json"), "remote-v1\n");
    git(source, "add", ".");
    git(source, "commit", "-m", "initial");
    git(source, "branch", "-M", "main");
    git(source, "push", "-u", "origin", "main");

    git(root, "clone", "-b", "main", remote, deploy);
    configureAuthor(deploy);
    writeFileSync(join(deploy, "server-only.txt"), "keep this commit\n");
    git(deploy, "add", "server-only.txt");
    git(deploy, "commit", "-m", "server-only commit");
    const serverCommit = git(deploy, "rev-parse", "HEAD");
    writeFileSync(join(deploy, "package-lock.json"), "server lockfile edit\n");
    writeFileSync(join(deploy, ".env"), "SECRET=preserved\n");

    writeFileSync(join(source, "remote.txt"), "new release\n");
    git(source, "add", "remote.txt");
    git(source, "commit", "-m", "remote release");
    git(source, "push", "origin", "main");
    git(deploy, "fetch", "origin", "main");

    execFileSync("sh", [syncScript, "origin/main"], {
      cwd: deploy,
      encoding: "utf8",
    });

    assert.equal(git(deploy, "rev-parse", "HEAD"), git(deploy, "rev-parse", "origin/main"));
    assert.equal(git(deploy, "status", "--short"), "");
    assert.match(git(deploy, "stash", "list"), /pre-deploy/);
    assert.match(git(deploy, "stash", "show", "--name-only", "stash@{0}"), /package-lock\.json/);
    assert.equal(git(deploy, "check-ignore", ".env"), ".env");

    const backupBranches = git(deploy, "for-each-ref", "--format=%(refname:short)", "refs/heads/deploy-backup/")
      .split("\n")
      .filter(Boolean);
    assert.equal(backupBranches.length, 1);
    assert.equal(git(deploy, "rev-parse", backupBranches[0]), serverCommit);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("VM deploy fetches the release sync script and never performs an ambiguous pull", () => {
  const workflow = readFileSync(deployWorkflow, "utf8");

  assert.doesNotMatch(workflow, /git pull(?:\s|$)/);
  assert.match(workflow, /git show origin\/main:scripts\/deploy-checkout-sync\.sh/);
  assert.match(workflow, /trap restore_deploy_remote EXIT/);
  assert.match(workflow, /sh "\$\{SYNC_SCRIPT\}" origin\/main/);
});
