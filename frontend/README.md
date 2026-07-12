# TransitOps — Frontend

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · hand-rolled design system (`design-system.css`,
HP Electric Blue accent) · Leaflet (live trips map) · Zod (client validation).

> Note: Next.js 16 has breaking changes vs older versions — see `AGENTS.md` and
> `node_modules/next/dist/docs/` before assuming Next 13/14-era patterns.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
```

Or run the whole stack (db + api + web) from the repo root: `./scripts/dev.sh`. The backend must
be up and migrated/seeded first — see `../backend/README.md` — otherwise every screen shows its
error state (no mock data fallback; this app only ever talks to the real API).

## Environment

`frontend/.env.local` (auto-generated from root `.env` by `scripts/dev.sh`):

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Architecture

- `src/lib/api.ts` — typed client for every backend endpoint; unwraps the `{error:{code,message,fields}}`
  envelope into `ApiError`.
- `src/lib/auth-context.tsx` — session state + login-gated routing (`useAuth()`).
- `src/lib/use-fetch.ts` — loading/error/data hook for a page's primary API call.
- `src/lib/use-event-stream.ts` — subscribes to the backend's SSE hub (`GET /events`); the
  dashboard and fleet map use this to update live without a refresh (see `trip.progress` /
  `kpi.refresh` handlers in `app/page.tsx` and `app/analytics/page.tsx`).
- `src/lib/rbac.ts` — mirrors `backend/core/rbac.py`'s write-capability aliases exactly; every
  role-gated button in the UI reads from here, not an independent guess at permissions.
- `src/lib/validation.ts` — Zod schemas for client-side form validation (currently: trip creation).

## Conventions

- Design tokens/theme live in `src/app/design-system.css` (plain CSS, not Tailwind `@theme`) —
  see `docs/05_UI_DESIGN.md` for the rationale on why this diverged from the original spec.
- RBAC gates: import `can` from `@/lib/rbac` and check `can.writeX(user?.role)` before rendering
  a write action — never hide/show based on a hardcoded role string.

## Checks

```bash
npm run lint
npm run build        # must stay green before merging to dev
```
