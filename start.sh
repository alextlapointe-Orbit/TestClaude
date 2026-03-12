#!/usr/bin/env bash
# Start the Claude Demo app (backend + frontend)
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ] && [ ! -f "$ROOT/backend/.env" ]; then
  echo "⚠  No ANTHROPIC_API_KEY found."
  echo "   Either set the env var or create backend/.env with:"
  echo "   ANTHROPIC_API_KEY=sk-ant-..."
  exit 1
fi

echo "🚀  Starting backend (FastAPI) on http://localhost:8000"
cd "$ROOT/backend"
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

echo "🚀  Starting frontend (Vite) on http://localhost:5173"
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅  App running at http://localhost:5173"
echo "   Press Ctrl+C to stop both servers."
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
