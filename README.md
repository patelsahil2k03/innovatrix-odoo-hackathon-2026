# Innovatrix — Odoo Hackathon 2026

[![Demo Video](https://img.shields.io/badge/Demo-Video-red?style=for-the-badge&logo=youtube)](ADD_DEMO_LINK_HERE)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

> **Note:** Replace `ADD_DEMO_LINK_HERE` above with the public application demo video link before final submission.

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
| Frontend | Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui |
| Visualization | MapLibre GL JS + deck.gl (animated trips map) · Recharts (analytics) |
| Backend | FastAPI (Python 3.13, managed by uv) · REST + Server-Sent Events |
| Database | PostgreSQL 18 (Docker) · SQLAlchemy 2.0 · Alembic migrations · SQLite fallback |
| Auth | JWT (httpOnly cookie) with Role-Based Access Control — 4 roles |

## Repository Structure

```
frontend/   Next.js app — UI, screens, client-side validation
backend/    FastAPI app — REST API, business rules, SSE, data layer
infra/      docker-compose (PostgreSQL)
scripts/    dev.sh (one-command dev stack) and ops helpers
```

## Features

_[To be added as the application takes shape]_

## Getting Started

### Prerequisites

- Node.js ≥ 20 (tested on 22)
- [uv](https://docs.astral.sh/uv/) ≥ 0.9 (auto-installs Python 3.13)
- Docker + Compose v2 (for PostgreSQL — optional, SQLite fallback available)

### Quick start (one command)

```bash
git clone https://github.com/patelsahil2k03/innovatrix-odoo-hackathon-2026.git
cd innovatrix-odoo-hackathon-2026
./scripts/dev.sh
```

That single command creates `.env` from the template, starts PostgreSQL in Docker (waits for
health), then runs the API (`http://localhost:8000` — docs at `/docs`) and the web app
(`http://localhost:3000`) with hot reload. `Ctrl+C` stops everything.
No Docker? `./scripts/dev.sh --no-db` with the SQLite `DATABASE_URL` from `.env.example`.

### Running pieces manually

```bash
# Database
docker compose -f infra/docker-compose.yml up -d db

# Backend (from backend/)
uv sync && uv run uvicorn transitops.main:app --reload   # http://localhost:8000/docs

# Frontend (from frontend/)
npm install && npm run dev                               # http://localhost:3000

# Tests
cd backend && uv run pytest
```

Per-app details: [frontend/README.md](frontend/README.md) · [backend/README.md](backend/README.md)

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
