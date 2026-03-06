#!/usr/bin/env bash
# Sync only production-needed paths from develop to main.
# Run from develop branch. This script is not synced to main (only lives in develop).

set -e

REMOTE="${REMOTE:-origin}"
MAIN_BRANCH="${MAIN_BRANCH:-main}"
DEVELOP_BRANCH="${DEVELOP_BRANCH:-develop}"

# Paths to sync from develop to main (prod only). This script is NOT in the list.
SYNC_PATHS=(
  backend
  frontend
  docker
  .gitignore
  .env.production.example
  docs
  scripts
)

# Under synced paths: files to remove from main (so they exist only in develop).
EXCLUDE_FROM_MAIN=(
  scripts/sync-to-main.sh
)

current_branch=$(git branch --show-current)
if [[ "$current_branch" != "$DEVELOP_BRANCH" ]]; then
  echo "Error: run this script from branch '$DEVELOP_BRANCH' (current: $current_branch)"
  exit 1
fi

if [[ -n $(git status --porcelain) ]]; then
  echo "Error: working tree is not clean. Commit or stash changes first."
  exit 1
fi

echo "Fetching $REMOTE..."
git fetch "$REMOTE"

echo "Syncing to $MAIN_BRANCH (only prod paths)..."
git checkout "$MAIN_BRANCH"
git pull "$REMOTE" "$MAIN_BRANCH"

# Remove from main any file not under SYNC_PATHS (so main keeps only prod)
while IFS= read -r f; do
  under=
  for path in "${SYNC_PATHS[@]}"; do
    [[ "$f" == "$path"/* || "$f" == "$path" ]] && { under=1; break; }
  done
  [[ -z "$under" ]] && git rm -f "$f" 2>/dev/null || true
done < <(git ls-files)

# Bring in selected paths from develop
for path in "${SYNC_PATHS[@]}"; do
  git checkout "$DEVELOP_BRANCH" -- "$path" 2>/dev/null || true
done

# Remove files that must not be in main (index + worktree so they are not re-added)
for path in "${EXCLUDE_FROM_MAIN[@]}"; do
  if git ls-files --error-unmatch "$path" &>/dev/null; then
    git rm -f --cached "$path" 2>/dev/null || true
    rm -f "$path" 2>/dev/null || true
  fi
done

if git diff --cached --quiet && git diff --quiet; then
  echo "No changes to commit."
else
  git add -A
  git commit -m "chore: sync from develop for production"
  git push "$REMOTE" "$MAIN_BRANCH"
  echo "Pushed to $REMOTE/$MAIN_BRANCH"

  # Run DB backup before deploying new version
  echo "Running pre-deploy DB backup..."
  COMPOSE_FILE="${COMPOSE_FILE:-docker/docker-compose.prod.yml}"
  ENV_FILE="${ENV_FILE:-.env.production}"
  if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db_backup /usr/local/bin/backup-db.sh 2>/dev/null; then
    echo "Pre-deploy DB backup completed."
  elif docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db_backup /usr/local/bin/backup-db.sh 2>/dev/null; then
    echo "Pre-deploy DB backup completed."
  else
    echo "Warning: DB backup failed or db_backup container is not running. Skipping."
  fi
fi

git checkout "$DEVELOP_BRANCH"
echo "Back on $DEVELOP_BRANCH. Done."
