# TransitOps — Backend API

FastAPI · Python 3.13 (managed by [uv](https://docs.astral.sh/uv/)) · SQLAlchemy 2.0 + Alembic ·
PostgreSQL 18 (SQLite fallback) · SSE for real-time.

## Run

```bash
uv sync                                            # installs Python 3.13 + deps into .venv
uv run uvicorn transitops.main:app --reload        # http://localhost:8000
```

Or run the whole stack (db + api + web) from the repo root: `./scripts/dev.sh`

- Interactive API docs: http://localhost:8000/docs
- Health: `GET http://localhost:8000/api/v1/health`

## Environment

`backend/.env` (auto-copied from root `.env` by `scripts/dev.sh`). Key vars:
`DATABASE_URL` (Postgres default; `sqlite:///./transitops.db` fallback), `JWT_SECRET`, `SIMULATOR_ENABLED`.

## Layout

```
src/transitops/
├── main.py       # app factory
├── core/         # settings, security/JWT, RBAC, event pub/sub
├── models/       # SQLAlchemy models        (Card C)
├── schemas/      # pydantic request/response (Card B)
├── routers/      # one file per resource     (Card B)
├── services/     # dispatch rules, analytics, simulator, suggestions
└── seed/         # seed script + generators  (Card C)
```

API surface is contract-first: `docs/04_API_CONTRACT.md` is the source of truth.
Branches: `feature/backend-api` (routers/schemas/core) · `feature/database-integration` (models/seed/analytics).

## Tests & migrations

```bash
uv run pytest                                      # business-rule tests (must pass before dev merge)
uv run alembic upgrade head                        # apply migrations (once Card C lands them)
uv run python -m transitops.seed                   # seed demo data (Card C)
```
