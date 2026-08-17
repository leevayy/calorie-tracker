#!/bin/sh

set -eu

target_ref="${1:-origin/main}"
target_sha="$(git rev-parse --verify "${target_ref}^{commit}")"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"

if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
  git stash push --include-untracked -m "pre-deploy ${stamp} before ${target_sha}"
fi

git checkout main
current_sha="$(git rev-parse HEAD)"

if [ "${current_sha}" != "${target_sha}" ] && \
  ! git merge-base --is-ancestor "${current_sha}" "${target_sha}"; then
  short_current="$(git rev-parse --short "${current_sha}")"
  backup_base="deploy-backup/${stamp}-${short_current}"
  backup_branch="${backup_base}"
  suffix=1
  while git show-ref --verify --quiet "refs/heads/${backup_branch}"; do
    backup_branch="${backup_base}-${suffix}"
    suffix=$((suffix + 1))
  done
  git branch "${backup_branch}" "${current_sha}"
  echo "Preserved divergent VM commit at ${backup_branch}"
fi

git reset --hard "${target_sha}"
echo "Deployment checkout now matches ${target_ref} (${target_sha})"
