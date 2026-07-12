# TransitOps — Backend API

FastAPI · Python 3.13 (managed by [uv](https://docs.astral.sh/uv/)) · SQLAlchemy 2.0 + Alembic ·
PostgreSQL 18 (SQLite fallback) · SSE for real-time.

## Run

```bash
uv sync                                            # installs Python 3.13 + deps into .venv
uv run alembic upgrade head                        # apply migrations
uv run python -m transitops.seed                   # first run only — prints demo logins
uv run uvicorn transitops.main:app --reload        # http://localhost:8000
```

Or run the whole stack (db + api + web) from the repo root: `./scripts/dev.sh`

- Interactive API docs: http://localhost:8000/docs
- Health: `GET http://localhost:8000/api/v1/health`
- Reset to a fresh, fully-seeded demo state at any time: `../scripts/demo-reset.sh`

## Environment

`backend/.env` (auto-copied from root `.env` by `scripts/dev.sh`). Key vars:
`DATABASE_URL` (Postgres default; `sqlite:///./transitops.db` fallback), `JWT_SECRET`, `SIMULATOR_ENABLED`.

## Layout

```
src/transitops/
├── main.py       # app factory, lifespan (binds SSE hub, starts the simulator task)
├── core/         # settings, security/JWT, RBAC, event pub/sub, audit middleware
├── models/       # SQLAlchemy models
├── schemas/      # pydantic request/response
├── routers/      # one file per resource
├── services/     # dispatch.py (the business-rule engine), analytics, simulator, suggestions
└── seed/         # deterministic seed script + generators
```

API surface is contract-first: `docs/04_API_CONTRACT.md` is the source of truth. Every business
rule (`docs/00_MASTER_PLAN.md` §5) is enforced in `services/dispatch.py` inside a locked DB
transaction — not just in a router or the frontend.

## Tests & migrations

```bash
uv run pytest                                      # 72 tests: business rules, RBAC, API surface
uv run alembic upgrade head                        # apply migrations
uv run alembic check                               # verify models match the latest migration (no drift)
uv run python -m transitops.seed [--reset]         # seed demo data; --reset wipes tables first
```
