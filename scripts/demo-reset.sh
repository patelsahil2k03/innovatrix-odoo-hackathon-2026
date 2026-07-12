#!/usr/bin/env bash
# TransitOps — wipe every table and reseed deterministic demo data, in one command:
#   ./scripts/demo-reset.sh
# Safe to run repeatedly — it always resets to the same seed (see backend/src/transitops/seed).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

uv sync --quiet
uv run alembic upgrade head
uv run python -m transitops.seed --reset
