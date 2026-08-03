# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is the backend (`paisaPalAPI/`) of PaisaPal, a personal expense tracker. See the root `../CLAUDE.md` and `../CONTEXT.md` for the whole-project view; this file is the deep map of this subproject specifically.

## Commands

```bash
npm run dev                 # ts-node-dev --respawn, watches src/server.ts (loads env, calls app.listen)
npm run build                # tsc -p tsconfig.json -> dist/
npm start                     # node dist/src/server.js (run build first)
npm run lint                   # eslint .
npm run format                  # prettier --write .
npm test                         # vitest run — spins up mongodb-memory-server, no real DB/.env needed
npm run test:watch
npx vitest run tests/transactions.test.ts              # single test file
npx vitest run tests/transactions.test.ts -t "name"     # single test case
npm run seed                     # ts-node-dev scripts/seed.ts
npm run seed:docker               # docker compose exec api npm run seed
docker compose up --build          # API + Mongo together (docker-compose.yml)
```

There is no typecheck-only script; `tsc` runs as part of `build`.

## Request flow

`src/server.ts` (local/Docker entrypoint, calls `app.listen`) and `api/index.ts` (Vercel serverless entrypoint, just imports `dotenv/config` + the app) both import the same Express app from `src/index.ts`. When changing app-level middleware/wiring, both entrypoints are affected — don't put logic in `server.ts` that the serverless path also needs.

`src/index.ts` wires, in order: `helmet()` → CORS (see below) → `express.json({ limit: '10kb' })` → `requestLogger` (assigns `req.requestId`, pino-logs on response finish) → rate limit (100 req/15min) on `/api` → `/healthz` + `/api/healthz` → `apiRoutes` (`src/routes/index.ts`, mounts one router per resource under `/api/<resource>`) → `notFound` → `errorHandler` (normalizes Mongoose `CastError`/`ValidationError`/duplicate-key 11000 into the standard envelope, logs via pino in production, `console.error` in dev).

**Env loading** (`src/server.ts` only — `api/index.ts` just does `dotenv/config`): loads root `.env` first if present (`override:true`), then `configs/envs/.env.${APP_ENV}.config` as defaults (`APP_ENV` defaults to `development`; falls back to legacy `.env.${APP_ENV}` at repo root if the configs file is missing).

**CORS**: allows `FRONTEND_URL` env var, `localhost:8080/5173/3000`, and any `https://*.vercel.app` origin (preview deploys) — see the `origin` callback in `src/index.ts`.

## Auth

Handled entirely in `src/routes/auth.ts` (no `controllers/auth.ts` — routes hold the logic directly): register/login hash with bcrypt (12 rounds) and issue a single `jsonwebtoken` HS256 token, `JWT_EXPIRY = '7d'`, no refresh mechanism at all — `User` has no `refreshTokens` field, every login/register just issues a fresh 7-day token. `middleware/auth.ts#requireAuth` validates `Authorization: Bearer <token>` and sets `req.user = { userId, email }`. Every non-auth route calls `router.use(requireAuth)` before its handlers. `JWT_SECRET` must be ≥32 chars or every auth-touching endpoint fails closed with 500 `SERVER_CONFIG_ERROR`.

## Response envelope & error shape

Every endpoint returns `{ data, error, message? }`; errors add `errorCode`, `suggestion` (a user-facing hint), and `requestId` (from `requestLogger`). This is manual in every controller/route (no shared response helper) — copy the exact shape (see any `controllers/*.ts` 404 branch) when adding new error paths. `middleware/validate.ts` (Zod, `body` or `query` target) additionally returns `details` (zod's `flatten()`) and `fieldErrors`.

## Data model reality check — non-obvious mappings

These two are the most likely things to trip up a future change:

- **"Budgets" have no `Budget` model.** `controllers/budgets.ts` stores budgets as *items inside the `Envelope` document* for that user+month (`Envelope.envelopes[]`), and maps each envelope item to a `{ category, monthlyLimit, month, ... }` "Budget" shape (`toBudgetAlias`) purely in the response. Creating/editing/deleting a "budget" via `/api/budgets` mutates `Envelope.envelopes`, the same array `/api/envelopes` reads/writes directly. The two features share one collection.
- **"Recurring rules" and "recurring transactions" are the same collection, filtered differently.** Both `controllers/recurring.ts` (mounted at `/api/recurring`, legacy "rule" API) and `controllers/recurringTransactions.ts` (mounted at `/api/recurring-transactions`, newer API) read/write the single `RecurringTransaction` model. `recurring.ts` only ever touches documents with `autoGenerate: true` and reshapes them via `toRuleLike()` (adds `isActive`, `nextDue` aliases); `recurringTransactions.ts` operates on the full set regardless of `autoGenerate` and returns the raw document plus computed `daysUntilDue`/`projectedMonthly`/`projectedYearly`. A document created through one API can be invisible to the other depending on its `autoGenerate` flag.
- **`AuditLog`'s schema enum is stale.** `models/AuditLog.ts`'s `resource` enum is `['transaction', 'settings', 'budget', 'recurring', 'category']`, but `lib/audit.ts#createAuditLog`'s TS type additionally allows `'savings_goal' | 'savings_contribution' | 'recurring_transaction' | 'envelope'` — and those resource types are actually passed by `controllers/savings.ts`, `envelopes.ts`, `recurringTransactions.ts`. Since `createAuditLog` does `void AuditLog.create(...).catch(err => console.error(...))` (fire-and-forget), a Mongoose validation error there is swallowed silently — audit logs for savings/envelope/recurring-transaction actions likely never actually get written. If you need audit history for those resources to work, fix the schema enum first.
- **`dateKey`** (`YYYY-MM-DD`, Asia/Kolkata) is computed via `lib/recurringUtils.ts#toIstDateKey` / inlined per-controller `toIstDateKey()` helpers (duplicated in several controllers rather than always imported — grep for `toIstDateKey` before assuming there's one canonical copy) and is what every month/day filter and aggregation groups on, never the raw `date`. `controllers/transactions.ts#listTransactions` lazily backfills missing `dateKey` on read via an `updateMany` at the top of the handler.
- **IST date arithmetic** (`lib/recurringUtils.ts`) manually offsets UTC by 330 minutes (`istStartOfDayUtc`, `makeIstStartUtc`) rather than using a timezone library — `calculateNextDueDate` clamps day-of-month to the target month's last day (`clampToMonthEnd`) so e.g. Jan 31 monthly correctly becomes Feb 28/29.

## Side-effect chains on transaction writes

`createTransaction`/`updateTransaction`/`deleteTransaction` in `controllers/transactions.ts` each fire an unawaited `void (async () => {...})()` block after responding that: (1) re-syncs the affected category's envelope `spent`/`status` for that month via `lib/envelopeSync.ts#syncEnvelopeForTransaction`, and (2) on create only, if `category === 'Rapido'`, runs `lib/rapidoTax.ts#applyRapidoTaxContribution` — auto-contributes a settings-configured percentage of the fare to the user's primary (or first active) savings goal, if `settings.rapidoTaxEnabled`. Both are best-effort (`catch { /* fire-and-forget */ }`) — failures are silent, not surfaced to the client. The offline sync path (`routes/sync.ts`) does **not** run these side effects — it creates/updates/deletes `Transaction` documents directly without touching envelopes or Rapido tax.

## Offline sync (`routes/sync.ts`)

`POST /api/sync` takes `{ operations: SyncOperation[] }` where each op has a client-generated `idempotencyKey`, `operation` (`create`/`update`/`delete`), `resource` (`transaction`/`settings`), and `data`. Each op is processed independently (own try/catch, own entry in the `results[]` response) so partial failure is normal. Before applying an op, it checks `IdempotencyKey` (TTL-indexed, 24h expiry, unique on `key`) — if the key was already processed, it returns the cached `resourceId` without redoing the write, making replayed offline batches safe. `GET /api/sync/status` just counts pending `IdempotencyKey` docs.

**There is no `/api/sync/pull` "full dataset" endpoint** despite `CONTEXT.md` describing one — `routes/sync.ts` only has `POST /` (push) and `GET /status`. The frontend bootstraps offline state by calling the normal per-resource endpoints individually (`fetchAllTransactions`, `fetchSettings`, etc. in `paisaPalFrontend/src/lib/api.ts`), not a single bulk-pull call. Treat any reference to `sync/pull` in `CONTEXT.md` as stale.

## CSV import (`services/transactions.service.ts`)

`importTransactionsFromCsv` parses with `csv-parse`, normalizes column headers case-insensitively with aliases (`description`→`particulars`, `amount paid`/`amount_paid`→`amount`, `mode of payment`/`payment mode`→`mode`, `note`→`notes`), validates each row against `TransactionSchema` (collecting row-level errors rather than failing the whole import), and flags duplicates by exact match on `(dateKey, particulars, amount)` scoped to the user. Supports `dryRun` (returns a `preview[]` with per-row duplicate flags, inserts nothing) and `skipDuplicates` (excludes flagged rows from the actual insert). `TransactionSchema.date` (`schemas/index.ts`) accepts both `DD-MM-YYYY` and `YYYY-MM-DD` via a custom `parseDDMMYYYY` transform — this is also what every other date-accepting Zod schema (`RecurringRuleSchema.startDate`, `SavingsGoalCreateSchema.deadline`, etc.) reuses as `DDMMYYYYDateSchema`.

## Business logic modules (`src/lib/`)

- `detectRecurring.ts` — groups the user's full transaction history by `normalize(particulars)+amount`, needs ≥3 occurrences, computes the mean/stddev of day-gaps between them, maps the mean gap to a `Frequency` bucket (`daily`≤2d, `weekly`≤9d, `biweekly`≤18d, `monthly`≤45d, `yearly`≥300d — gaps in between produce no suggestion), and only keeps a suggestion if `confidence = 1 - (stddev/mean)` ≥ 0.55. Powers `GET /api/recurring-transactions/detect`.
- `envelopeSync.ts` / inline logic in `controllers/envelopes.ts` — envelope `status` is `under` / `warning` (≥ `envelopeWarningThreshold`%, default 80) / `over` (>100%), recomputed from a live `Transaction` aggregation, not stored authoritatively between syncs.
- `rapidoTax.ts` — see "side-effect chains" above.
- `recurringUtils.ts` — the shared IST-date and frequency-projection math (`calculateNextDueDate`, `getProjectedMonthly`/`Yearly`, `getDaysUntilDue`) used by both recurring controllers and `savingsStats.ts`.
- `audit.ts` — see the `AuditLog` enum mismatch above.

## Testing

`tests/*.test.ts` (Vitest + Supertest) spin up `mongodb-memory-server` in-process — running `npm test` needs no external MongoDB, no `.env`, and no network. `tests/testUtils.ts` holds shared setup. Tests exist for: `budgets`, `recurring`, `settings`, `stats`, `transactions`. There are currently no tests covering `savings`, `envelopes`, `recurringTransactions`, `sync`, or `auth` — be extra careful with manual verification when touching those.
