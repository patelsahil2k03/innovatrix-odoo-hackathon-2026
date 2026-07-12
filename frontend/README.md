# TransitOps — Frontend

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (added by Card A) ·
MapLibre GL + deck.gl (trips map, added by Card D).

> Note: Next.js 16 has breaking changes vs older versions — see `AGENTS.md` and
> `node_modules/next/dist/docs/` before assuming Next 13/14-era patterns.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
```

Or run the whole stack (db + api + web) from the repo root: `./scripts/dev.sh`

## Environment

`frontend/.env.local` (auto-generated from root `.env` by `scripts/dev.sh`):

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

Until the API is up, screens run on mocked fetch that mirrors `docs/04_API_CONTRACT.md`.

## Conventions

- Design tokens live in `src/styles` (Tailwind v4 `@theme`) — locked once committed; see `docs/05_UI_DESIGN.md`
- Client validation: zod schema per form, mirroring the API contract's rules
- Branch: `feature/frontend-ui` → `dev` (see `docs/team/CARD_A_FRONTEND.md`)

## Checks

```bash
npm run lint
npm run build        # must stay green before merging to dev
```
