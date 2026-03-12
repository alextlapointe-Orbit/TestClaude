#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "==> Installing Python dependencies..."
pip install -q -r "$CLAUDE_PROJECT_DIR/backend/requirements.txt"

echo "==> Installing Node dependencies..."
cd "$CLAUDE_PROJECT_DIR/frontend"
npm install

echo "==> Building frontend static assets..."
npm run build

echo "==> Session start complete."
