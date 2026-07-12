#!/usr/bin/env bash
# TransitOps — one command to run the whole dev stack:
#   ./scripts/dev.sh          → db (docker) + api (uvicorn --reload) + web (next dev)
#   ./scripts/dev.sh --no-db  → skip docker (e.g. when using the SQLite fallback)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Propagate root .env (create from example on first run)
[ -f .env ] || { cp .env.example .env && echo "→ created .env from .env.example"; }
cp .env backend/.env
grep '^NEXT_PUBLIC_' .env > frontend/.env.local || true

# Defensive: uvicorn's --reload watcher and Next.js/Turbopack's worker processes don't always
# die with the rest of the tree on an unclean exit (Ctrl+C, crash) — a leftover listener on
# 3000/8000 is what causes "port 3000 in use, using 3001 instead" on the next run. Clear them
# before starting, not just on exit.
fuser -k 3000/tcp 8000/tcp >/dev/null 2>&1 || true

if [[ "${1:-}" != "--no-db" ]]; then
  echo "→ starting postgres (docker)…"
  docker compose -f infra/docker-compose.yml up -d db
  echo "→ waiting for db health…"
  until [ "$(docker inspect -f '{{.State.Health.Status}}' transitops-db 2>/dev/null)" = "healthy" ]; do sleep 1; done
fi

cleanup() {
  echo
  echo "→ stopping…"
  # kill 0 alone is not reliable here: `uv run uvicorn --reload` forks a separate watcher
  # subprocess, and npm/Next.js don't always forward SIGTERM to their own children — both can
  # survive a plain process-group kill. Killing by actual port ownership works regardless of
  # how the process tree is shaped.
  fuser -k 3000/tcp 8000/tcp >/dev/null 2>&1 || true
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "→ starting api  http://localhost:8000/docs"
(cd backend && uv sync --quiet && uv run uvicorn transitops.main:app --reload --port 8000) &

echo "→ starting web  http://localhost:3000"
(cd frontend && [ -d node_modules ] || npm install; npm run dev) &

wait
