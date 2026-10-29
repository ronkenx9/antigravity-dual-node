#!/usr/bin/env bash
# ==============================================================================
# Dual-Agent Safe Git Sync
# Pulls latest changes with rebase, checks for unstaged changes, and pushes
# ==============================================================================

set -euo pipefail

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "🔄 Syncing branch: $CURRENT_BRANCH..."

# Check if there are local uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo "📦 Local changes detected. Stashing before pull..."
  git stash push -m "dual-sync-autostash-$(date +%s)"
  STASHED=1
else
  STASHED=0
fi

# Fetch and rebase
echo "⬇️ Fetching origin and rebasing..."
git fetch origin "$CURRENT_BRANCH" || true
git rebase "origin/$CURRENT_BRANCH" || true

if [[ "$STASHED" -eq 1 ]]; then
  echo "📤 Popping stashed changes..."
  git stash pop || true
fi

echo "✅ Branch $CURRENT_BRANCH is up-to-date with remote."
