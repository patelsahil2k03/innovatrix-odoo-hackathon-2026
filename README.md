# Innovatrix — Odoo Hackathon 2026

[![Demo Video](https://img.shields.io/badge/Demo-Video-red?style=for-the-badge&logo=googledrive)](https://drive.google.com/drive/folders/15lhtf5ktAFehLSVLiwhhYXHWjMpj5B1t?usp=drive_link)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

Team Innovatrix's submission for the Odoo Hackathon 2026 virtual round — an 8-hour build against a surprise problem statement.

## Table of Contents

- [Team](#team)
- [Problem Statement](#problem-statement)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Getting Started](#getting-started)
- [Contribution Workflow](#contribution-workflow)
- [License](#license)

## Team

**Innovatrix**

| Name | Role |
|---|---|
| Sahil Patel | Team Lead |
| Devasya Joshi | Member |
| Gaurav Rathva | Member |
| Pranjal Shah | Member |

Evaluator: Pawan Gupta

## Problem Statement

**TransitOps — Smart Transport Operations Platform**

An end-to-end transport operations platform that digitizes vehicle, driver, dispatch, maintenance, and expense management while enforcing business rules and providing operational insights.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 (hand-rolled design system, HP Electric Blue) |
| Visualization | Leaflet (live-animated trips map via SSE) · hand-rolled SVG charts |
| Validation | Zod (client) mirroring FastAPI/Pydantic (server) — cargo-vs-capacity, required fields, etc. |
| Backend | FastAPI (Python 3.13, managed by uv) · REST + Server-Sent Events |
| Database | PostgreSQL 18 (Docker) · SQLAlchemy 2.0 · Alembic migrations · SQLite fallback |
| Auth | JWT (httpOnly cookie) with Role-Based Access Control — 4 roles, enforced server-side |

## Repository Structure

```
frontend/   Next.js app — UI, screens, client-side validation
backend/    FastAPI app — REST API, business rules, SSE, data layer
infra/      docker-compose (PostgreSQL)
scripts/    dev.sh (one-command dev stack) and ops helpers
```

## Features

- **Auth & RBAC** — JWT login, 4 roles (Fleet Manager, Dispatcher, Safety Officer, Financial
  Analyst); every write endpoint is role-gated server-side, and the UI hides actions a role
  can't perform (see the Settings page's capability matrix for the exact mapping).
- **Fleet & driver registry** — full CRUD (create, edit, view) with document tracking and
  computed health/performance metrics.
- **Trip dispatch** — creation wizard with a live vehicle-capacity meter (cargo can never
  exceed the selected vehicle's max load, enforced client- and server-side), dispatch/complete/
  cancel lifecycle, and AI-scored vehicle+driver suggestions for draft trips.
- **Maintenance workflow** — opening a job moves the vehicle to *In Shop* and out of the
  dispatch pool; closing it restores *Available* (unless retired) — both live from the vehicle
  detail page.
- **Fuel & expense logging** with an auto-computed total operational cost per vehicle
  (fuel + maintenance + other).
- **Live dashboard & map** — KPIs and the fleet map update in real time via Server-Sent Events
  as trips progress, dispatch, or complete — no manual refresh, no static data.
- **Analytics & reports** — fleet utilization, fuel efficiency, cost/km, ROI, weekly trends, and
  CSV export (fleet / trips / expenses).
- **Deterministic seed data** — one command populates a realistic fleet (25 vehicles, 20
  drivers — including intentionally expired licenses and a suspended driver to demo the
  blocking rules, 60+ trips, fuel logs, expenses, and alerts).

**Out of scope for this build:** PDF export, email reminders for expiring licenses (in-app
alerts exist instead), and a full light theme (the design system is dark-only by design).

## Getting Started

### Prerequisites

- Node.js ≥ 20 (tested on 22)
- [uv](https://docs.astral.sh/uv/) ≥ 0.9 (auto-installs Python 3.13)
- **Docker + Compose v2** for PostgreSQL — **optional**, see "Don't have Docker?" below for a
  fully-tested SQLite path that needs zero containers.

### Quick start (one command, with Docker)

```bash
git clone https://github.com/patelsahil2k03/innovatrix-odoo-hackathon-2026.git
cd innovatrix-odoo-hackathon-2026
./scripts/dev.sh
```

That single command creates `.env` from the template, starts PostgreSQL in Docker (waits for
health), then runs the API (`http://localhost:8000` — docs at `/docs`) and the web app
(`http://localhost:3000`) with hot reload. `Ctrl+C` stops everything.

**Don't have Docker installed?** Get it here, then use the command above as normal:
[Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) ·
[Docker Engine](https://docs.docker.com/engine/install/) (Linux). Or skip Docker entirely —
next section.

### Don't have Docker at all? Use SQLite instead (verified working, zero containers)

`./scripts/dev.sh --no-db` only skips *starting* the Postgres container — it does **not**
change which database the app points at. You must also switch `DATABASE_URL` in `.env`
yourself:

```bash
git clone https://github.com/patelsahil2k03/innovatrix-odoo-hackathon-2026.git
cd innovatrix-odoo-hackathon-2026
cp .env.example .env
```

Then edit `.env`: comment out the `DATABASE_URL=postgresql+psycopg://...` line and uncomment
the `DATABASE_URL=sqlite:///./transitops.db` line right below it. Then:

```bash
./scripts/dev.sh --no-db
```

This has been tested end-to-end (migrations, seed, and the API all run identically against
SQLite) — nothing else needs to change.

**First run only** — apply migrations and seed demo data (in a second terminal, once the API is up):

```bash
cd backend && uv run alembic upgrade head && uv run python -m transitops.seed
```

This prints four demo logins (one per role) with a shared password to stdout — use them to sign
in at `http://localhost:3000/login` and see each role's different permissions:

| Email | Password | Role | Name | Focus |
|---|---|---|---|---|
| fleet@transitops.in | Demo@1234 | Fleet Manager | Rahul Kapoor | Vehicles, Maintenance |
| dispatch@transitops.in | Demo@1234 | Dispatcher | Sneha Iyer | Trips, Costs |
| safety@transitops.in | Demo@1234 | Safety Officer | Anil Deshmukh | Drivers, Compliance |
| finance@transitops.in | Demo@1234 | Financial Analyst | Meera Nair | Costs, Reports |

### Root task-runner shortcuts

A root `package.json` wraps the same commands as `npm run <script>` if you prefer not to juggle
directories:

```bash
npm run dev            # same as ./scripts/dev.sh
npm run be:migrate      # backend: alembic upgrade head
npm run be:seed         # backend: seed demo data
npm run be:test         # backend: pytest
npm run fe:build        # frontend: production build
npm run kill:ports      # free ports 3000/8000/8001 if a previous run didn't exit cleanly
```

### Running pieces manually

```bash
# Environment — create once; dev.sh does this step for you too, but only if .env
# doesn't already exist. If you already have a .env from before and something looks
# stale (e.g. a JWT-key-too-short warning), re-copy it: cp .env.example .env (this
# overwrites any local edits, so check `diff .env .env.example` first if unsure).
cp .env.example .env
cp .env backend/.env
grep '^NEXT_PUBLIC_' .env > frontend/.env.local

# Database — Docker path
docker compose -f infra/docker-compose.yml up -d db
# No Docker? Skip this and set DATABASE_URL=sqlite:///./transitops.db in .env instead —
# the next three commands work identically either way.

# Backend (from backend/)
uv sync
uv run alembic upgrade head
uv run python -m transitops.seed          # first run only — prints demo logins
uv run uvicorn transitops.main:app --reload   # http://localhost:8000/docs

# Frontend (from frontend/)
npm install && npm run dev                # http://localhost:3000

# Reset to a fresh, fully-seeded demo state at any time
./scripts/demo-reset.sh

# Tests
cd backend && uv run pytest
```

Per-app details: [frontend/README.md](frontend/README.md) · [backend/README.md](backend/README.md)

### Troubleshooting

- **"Port 3000 is in use... using 3001 instead"** — a previous run didn't shut down cleanly.
  `./scripts/dev.sh` now clears ports 3000/8000 defensively before starting (and on exit), so
  this shouldn't recur; if it does, run `npm run kill:ports` (or `fuser -k 3000/tcp 8000/tcp`)
  and try again.
- **Login requests fail / CORS errors in the browser console** — usually the port issue above:
  the backend only allows `http://localhost:3000` and `:3001` as CORS origins. If Next.js ever
  lands on a different port, add it to `cors_origins` in `backend/src/transitops/core/settings.py`.
- **`InsecureKeyLengthWarning` on the JWT key** — your `.env` predates a fix to the default
  secret; re-copy it: `cp .env.example .env && cp .env backend/.env`.

## Contribution Workflow

This repo uses `main`, a `dev` integration branch, four role-based feature branches, and a shared `experiments` branch:

```
main         (stable, demo-ready — only dev merges in here)
├── dev      (integration/testing — feature branches merge here first)
│   ├── feature/frontend-ui           — UI/UX, components, responsiveness, styling
│   ├── feature/backend-api           — server, business logic, APIs
│   ├── feature/database-integration  — data modeling, DB setup, third-party integrations
│   └── feature/testing-docs          — testing, validation, docs, deployment/demo prep
└── experiments  (shared scratch space, not merged into main directly)
```

The role split holds regardless of the eventual tech stack, since it separates by concern, not framework. Feature branches merge into `dev` for integration and testing; `dev` merges into `main` once stable, keeping `main` demo-ready at all times. `experiments` is a shared scratch space for spikes and proofs of concept — useful work is cherry-picked into a feature branch rather than merged directly into `main`.

## License

Released under the [MIT License](LICENSE).
