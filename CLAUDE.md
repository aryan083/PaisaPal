# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

PaisaPal is a personal expense tracker for Indian users (₹). Two independent projects live in this repo, each with its own `node_modules`, `package.json`, and lockfile — **there is no root workspace/build tool**, so commands must be run from inside the relevant subfolder:

- `paisaPalAPI/` — Express 5 + TypeScript REST API, MongoDB via Mongoose, deployed to Vercel as a serverless function (`api/index.ts`).
- `paisaPalFrontend/` — React 18 + Vite + TypeScript SPA (originally scaffolded by Lovable, uses shadcn-ui), Zustand for state, IndexedDB for offline persistence.

A detailed architecture reference already exists at `CONTEXT.md` (data models, Zustand store shape, dashboard component list, dashboard-utils API, conventions) — read it for anything beyond the big-picture orientation below. It was last regenerated after the `dashboard-enhancements` feature; treat it as accurate for architecture/conventions but verify against source for anything security- or auth-related (see note below).

## Commands

All commands are run from inside `paisaPalAPI/` or `paisaPalFrontend/` respectively — there is no root-level script runner.

### Backend (`paisaPalAPI/`)
```bash
npm run dev              # ts-node-dev, watches src/server.ts
npm run build             # tsc -p tsconfig.json -> dist/
npm start                 # node dist/src/server.js (run build first)
npm run lint               # eslint .
npm run format              # prettier --write .
npm test                    # vitest run (uses mongodb-memory-server, no real DB needed)
npm run test:watch
npx vitest run tests/transactions.test.ts   # single test file
npx vitest run tests/transactions.test.ts -t "test name"   # single test case
npm run seed                # seed local DB (ts-node-dev scripts/seed.ts)
```
Docker: `docker compose up --build` runs API + Mongo together (`docker-compose.yml`); `npm run seed:docker` seeds via the running container.

### Frontend (`paisaPalFrontend/`)
```bash
npm run dev          # vite dev server
npm run build         # vite build
npm run lint           # eslint .
npm test                # vitest run (jsdom env)
npm run test:watch
npx vitest run src/path/to/File.test.tsx   # single test file
npx playwright test    # e2e (config extends lovable-agent-playwright-config)
```

Neither project currently has a typecheck-only script — `tsc` runs as part of `npm run build` in both.

## Backend architecture

Request flow: `src/server.ts` (loads env, starts listener) → `src/index.ts` (Express app: helmet, CORS, JSON body limit 10kb, request logger, rate limiting on `/api`) → `src/routes/index.ts` mounts one router per resource under `/api/<resource>` → route handlers → Mongoose models. `errorHandler` (src/lib/errorHandler.ts) and `notFound` are the last two middlewares and normalize Mongoose `CastError`/`ValidationError`/duplicate-key (11000) into the standard error envelope.

- **Env loading** (`src/server.ts`): loads `.env` first (if present, `override:true`), then `configs/envs/.env.${APP_ENV}.config` (falls back to legacy `.env.${APP_ENV}` at repo root) as defaults. `APP_ENV` defaults to `development`.
- **Vercel entry**: `api/index.ts` is the serverless handler used in production; `src/server.ts` is the local/Docker entry that calls `app.listen`. Keep both working when touching `src/index.ts` (the Express app itself is shared).
- **Auth**: `routes/auth.ts` handles register/login/me/logout directly (no `controllers/auth.ts`) — passwords hashed with bcrypt (12 rounds), a single JWT (`JWT_EXPIRY = '7d'`, `HS256` via `jsonwebtoken`) is issued on register/login. `middleware/auth.ts#requireAuth` validates the `Authorization: Bearer <token>` header and populates `req.user = { userId, email }`. **There is no refresh-token mechanism** — despite claims elsewhere, `User` has no `refreshTokens` field; every login/register issues a fresh 7-day token. `JWT_SECRET` must be ≥32 chars or auth endpoints fail closed with `SERVER_CONFIG_ERROR`.
- **Response envelope**: every endpoint returns `{ data, error, message? }`; errors also include `errorCode`, `suggestion`, and `requestId` (see `routes/auth.ts` for the pattern used everywhere).
- **Validation**: Zod schemas in `src/schemas/index.ts`, applied via `middleware/validate.ts`.
- **`dateKey` convention**: every transaction stores both `date` (raw UTC `Date`) and `dateKey` (`YYYY-MM-DD` in Asia/Kolkata). All date filtering/aggregation uses `dateKey`, never raw `date` — see `src/lib/` helpers.
- **CORS**: allows `FRONTEND_URL`, `localhost:8080/5173/3000`, and any `*.vercel.app` origin (preview deploys).
- Business logic beyond simple CRUD lives in `src/lib/` (`recurringUtils.ts`, `detectRecurring.ts`, `envelopeSync.ts`, `rapidoTax.ts`, `audit.ts`) and `src/services/transactions.service.ts` — controllers stay thin and delegate here.
- Tests (`tests/*.test.ts`, Vitest + Supertest) spin up `mongodb-memory-server` — no external DB or `.env` needed to run `npm test`.

## Frontend architecture

- **No router** — navigation is a single Zustand `activeTab` field (`src/store/index.ts`), not `react-router` routes, despite `react-router-dom` being a dependency.
- **State**: one large Zustand store (`src/store/index.ts`, ~600 lines) holds transactions, settings, form/edit state, snapshot-view flag, etc. A separate `src/stores/syncStore.ts` tracks `isOnline`.
- **Offline-first**: `src/lib/idbStorage.ts` persists to IndexedDB; `src/stores/syncStore.ts#isOnline` (navigator.onLine) plus `isSnapshotView` (read-only mode) gate whether a given page hits the API or reads local/offline state — see the `effectiveOnline` pattern used in `TransactionsPage.tsx` and repeated elsewhere.
- **API layer**: all `fetch()` calls live in `src/lib/api.ts`. Auth token is read from `localStorage['auth-storage']` and sent as `Authorization: Bearer <token>`.
- **Sync**: there is no bulk `/api/sync/pull` endpoint (despite `CONTEXT.md` describing one) — offline bootstrap calls the normal per-resource endpoints individually. `POST /api/sync` applies a batch of offline mutations (`{ operations: [...] }`), each keyed by a client-generated idempotency key so replays are safe.
- **Pure computation**: `src/lib/dashboardUtils.ts` holds all stats/filtering functions (`computeFilteredStats`, `computeMonthMetrics`, `computeYearlyTrend`, `getAvailableMonths`, `filterTransactions`) — these are pure functions over `Transaction[]`, not store-coupled, so they're the place to add new derived metrics.
- **Path alias**: `@/` → `src/` (Vite + Vitest + TS all configured for it).
- **Styling**: TailwindCSS + CSS custom-property design tokens (`hsl(var(--primary))`, `--muted-foreground`, `--border`, `--card`, `--danger`, etc.); dashboard cards use the shared `.card-base` class.
- **Dashboard widgets** (`src/components/dashboard/`) mostly receive `stats: Stats | null` and/or `transactions: Transaction[]` as props; a few (`MonthTrendSparkline`, `MonthlyComparison`) read the Zustand store directly instead. Several widgets (`BudgetRing`, `MonthlyComparison`, `SpendingCalendar`, `MonthTrendSparkline`) only render in monthly view mode, not yearly.
- **Error handling**: async operations funnel through `getUserError(err, fallbackMsg)` → `toast.error(formatToastMessage(u))` for user-facing messages.

For full data model shapes (`Transaction`, `Stats`, `Settings`), the Zustand store's key slices/actions, and the complete dashboard component table, see `CONTEXT.md` sections 5–8 rather than duplicating them here.

## Feature specs

`.kiro/specs/<feature-name>/` holds `requirements.md` / `design.md` / `tasks.md` for features built via the Kiro spec workflow (currently `dashboard-enhancements`, `repeat-transaction-monthly-comparison`). Check there for design rationale before extending those features.
