# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is the frontend (`paisaPalFrontend/`) of PaisaPal, a personal expense tracker. See the root `../CLAUDE.md` and `../CONTEXT.md` for the whole-project view; this file is the deep map of this subproject specifically.

## Commands

```bash
npm run dev             # vite dev server
npm run build             # vite build
npm run lint                # eslint .
npm test                     # vitest run (jsdom env, setupFiles: src/test/setup.ts)
npm run test:watch
npx vitest run src/path/to/File.test.tsx              # single test file
npx playwright test                                     # e2e (config extends lovable-agent-playwright-config)
```

No typecheck-only script; `tsc` runs as part of `build`. `@/` resolves to `src/` (Vite + Vitest + TS all configured for it).

## The app has no real router — read this before touching navigation

`App.tsx` sets up `BrowserRouter`/`Routes` from react-router-dom, but there are only two routes: `/` → `Index`, `*` → `NotFound`. **`pages/Index.tsx` is the actual app shell/router.** All "page" switching is `activeTab: TabId` (Zustand, `store/index.ts`) compared with `===` in a big conditional block, no route params, no deep-linking beyond a `?snapshot=` query param. `components/NavLink.tsx` (a react-router `NavLink` wrapper) is dead code, imported nowhere.

To add a new page: add the id to `TabId` in `types/index.ts`, add a branch to `Index.tsx`'s conditional render, and add nav entries to both `components/layout/Sidebar.tsx` (`NAV_ITEMS`) and `components/layout/BottomNav.tsx` (`PRIMARY_TABS`/`MORE_TABS`) — a `TabId` with no nav entry is unreachable (see Dead code below for two that already are).

`App.tsx` also wraps everything in a react-query `QueryClientProvider`, but **no component anywhere calls `useQuery`/`useMutation`** — it's installed and provided but entirely unused; all data fetching is plain `useState`/`useEffect` + `lib/api.ts` calls.

### Auth gate & snapshot (read-only share link) mode, both in `Index.tsx`

- Shows a full-screen loader while `!hasHydrated || (token && isLoading)` (`hasHydrated` = Zustand-persist rehydration done, from `authStore`).
- If unauthenticated and no snapshot param → renders `AuthPage`.
- **Snapshot links work without login**: a `?snapshot=<base64url-json>` URL param (encoded/decoded via `lib/utils.ts#encodeSnapshot`/`decodeSnapshot`) is decoded and applied via `store.applySnapshot({ transactions, settings, budgets?, viewOnly: true })` even when the visitor isn't authenticated, setting `isSnapshotView = true`. If the visitor isn't authenticated yet, the encoded payload is stashed in `sessionStorage['pending_snapshot']` and re-applied once they do log in. `isSnapshotView` is threaded through nearly every page/hook/nav component as a guard — mutating actions early-return, and `Sidebar`/`BottomNav` prune their nav lists down to `[dashboard, transactions, envelopes]` in this mode. Snapshot creation itself (`shareSnapshot()`) lives in `SettingsPage.tsx`.

## State (Zustand, three stores)

### `store/index.ts` — main store (`useStore`), no persist middleware; individual fields hand-persisted to `localStorage`/IndexedDB

Notable state beyond the obvious: `transactionRevision: number` (bumped on every transaction mutation — pages watch this instead of a react-query cache key to know when to refetch/recompute), `activeTab` (persisted at `localStorage['paisa-active-tab']`), `theme` (persisted at `localStorage['paisa-theme']`, also sets `data-theme` on `<html>` — this is what light/dark CSS custom properties key off), `sidebarCollapsed` (`localStorage['paisa-sidebar-collapsed']`), `isSnapshotView`, `snapshotBudgets`.

**The online/offline dual-write pattern — transactions and settings only.** Every mutating action (`addTransaction`, `updateTransaction`, `removeTransaction`, `bulkRemoveTransactions`, `bulkAddTransactions`, `remapCategory`, `updateSettings`) reads `useSyncStore.getState().isOnline` imperatively (not the reactive hook) and branches:
- **online** → calls the real `lib/api.ts` function, uses the server response.
- **offline** → synthesizes a local record with `crypto.randomUUID()`, writes it to IndexedDB (`lib/storage.ts`), and enqueues an operation on `useSyncStore`'s offline queue for later replay.

Either branch updates `transactions`/`settings` in state, bumps `transactionRevision`, persists to IndexedDB, and recomputes `stats` (`computeStats()` — a near-duplicate of `lib/dashboardUtils.ts#computeFilteredStats`, kept in sync manually rather than shared).

**Savings goals, recurring transactions, and envelopes are NOT offline-capable.** Their state setters here (`setSavingsGoals`, `setRecurringTransactions`, `setEnvelopes`, etc.) are plain local mutators with no API calls or IndexedDB persistence of their own — the actual fetch/mutate/sync-into-store logic lives in `hooks/` (see below), which always call the live API and just early-return under `isSnapshotView`.

### `stores/authStore.ts` — `useAuthStore`, Zustand `persist`

`persist` config: `name: 'auth-storage'`, `partialize` keeps only `{ token, user }`. Confirmed on-disk shape: `localStorage['auth-storage']` is `{"state":{"token":"...","user":{...}},"version":0}` — `lib/api.ts#getAuthToken()` reads it via `JSON.parse(stored)?.state?.token`. `onRehydrateStorage` sets `hasHydrated = true` once localStorage read completes (this is what `Index.tsx` waits on before rendering anything). `login`/`register`/`checkAuth` use a **raw `fetch()` to a relative `/api/...` path** — not `lib/api.ts`'s `requestJson`, and not `getApiBaseUrl()`'s absolute production URL. Everything else in the app hits `getApiBaseUrl()` (`VITE_API_URL` env var, defaulting to `https://paisa-pal-alpha.vercel.app/api`). This means auth calls only work correctly when the frontend is served same-origin with (or proxied to) the API — check this first if login/register/`checkAuth` behave differently than every other API call in a given environment.

### `stores/syncStore.ts` — `useSyncStore`, Zustand `persist` (`name: 'sync-queue'`)

`queue: SyncOperation[]`, each with a client-generated `idempotencyKey` (uuid), matching the backend's `POST /api/sync` idempotency-key contract (`paisaPalAPI/src/routes/sync.ts`). `isOnline` is initialized from `navigator.onLine` and kept live via `window.addEventListener('online'/'offline', ...)` registered at module load (not inside a component). Setting online **auto-triggers `sync()`**. `sync()` only sends `create` ops and `settings` ops unconditionally; `update`/`delete` ops on a transaction are held back until a `clientId → serverId` mapping exists in IndexedDB's `id_map` store (populated once the matching `create` op has synced) — this is what makes offline edit-then-sync-order safe without an explicit dependency graph. On a successful `create` result, it live-patches `useStore`'s in-memory `transactions` array, swapping the local UUID for the server-assigned id.

## `lib/`

- **`api.ts`** — single `requestJson<T>()` fetch wrapper (injects bearer token, throws `ApiError` from `userError.ts` on `!res.ok || json.error`) backing ~40 exported functions, one or a few per backend resource (transactions, settings, stats, savings goals, recurring transactions, envelopes, recurring **rules** — see Dead code, budgets — see Dead code, audit). `exportTransactionsCsv`/`importTransactionsCsv` bypass `requestJson` (raw text response / multipart FormData respectively).
- **`dashboardUtils.ts`** — pure functions over `Transaction[]`: `computeMonthMetrics(txs, "YYYY-MM")`, `getAvailableMonths(txs)` (descending), `filterTransactions(txs, month, dayFilter)`, `computeFilteredStats(txs)` (dashboard's `Stats`, parallel logic to the store's `computeStats()`), `computeYearlyTrend(txs, year)` (always 12 zero-filled points).
- **`idbStorage.ts`** — raw IndexedDB via the `idb` package. One DB per user: `paisa-pal:<namespace>` where namespace is `user._id` or `'anonymous'`. Stores: `transactions` (full-overwrite on save, not incremental), `id_map` (`clientId → serverId`, the offline-sync bridge described above), `settings`.
- **`storage.ts`** — **not legacy, actively used.** A thin namespace-aware facade over `idbStorage.ts` (`getTransactions`/`saveTransactions`/`getSettings`/`saveSettings`, with `getSettings` seeding `DEFAULT_SETTINGS = {stipend:12000, extra:0, categoryConfig:[]}` if nothing is cached yet) — this is what `store/index.ts` actually imports, not `idbStorage.ts` directly.
- **`schemas.ts`** — `TransactionSchema` (zod) is wired to `TransactionForm.tsx` via `zodResolver`. `SettingsSchema` is defined but **not wired to any form** — `SettingsPage.tsx` does manual state + manual validation instead of react-hook-form.
- **`userError.ts`** — `ApiError` (carries `status`/`errorCode`/`suggestion`/`requestId`/`fieldErrors`) → `getUserError(err, fallbackTitle)` → `formatToastMessage(userError)`. This exact chain is the standard error-handling pattern reused at essentially every mutating call site in the app (pages, hooks, form components): `try { ... } catch (err) { const u = getUserError(err, 'Failed to X'); toast.error(formatToastMessage(u)) }`. Follow it for any new mutating code rather than inventing another pattern.
- **`utils.ts`** — `formatCurrency` (₹, en-IN), `parseLocalDate`/`toLocalDateKey` (IST-timezone-aware: ISO datetime strings are first converted to an IST calendar date via `toLocaleDateString('en-CA', {timeZone:'Asia/Kolkata'})` before parsing — matches the backend's `dateKey` convention, not naive browser-local time), `formatDate`/`formatDateShort`/`formatDateWithWeekday` variants, `generateId` (`crypto.randomUUID`), `encodeSnapshot`/`decodeSnapshot` (base64url JSON, the snapshot-share mechanism), and a small color-theory module (`hexToRgb`/`rgbToHsl`/`hslToRgb`/`rgbToHex`/`adjustCategoryHexForTheme`) backing `getAvailableCategories(settings?)` and `getCategoryHex(category, settings?)` — **all category color rendering goes through `getCategoryHex`**, never a raw hex literal in component code, so it can merge user-custom `settings.categoryConfig` colors over `DEFAULT_CATEGORY_HEX` and adjust for the current theme.

## `hooks/` — the pattern for "live" (non-offline) resources

`useEnvelopes(month)`, `useRecurringTransactions(status)`, `useSavingsGoals()`, `useSavingsStats()` all share one shape: auto-`refresh()` in a `useEffect` on mount/dep change, CRUD callbacks that call `lib/api.ts` then mirror the result into the global store via its plain setters, every call guarded by `if (isSnapshotView) return`, and the same `getUserError`/toast pattern on failure. None of them touch IndexedDB or the offline sync queue — they always hit the live API. Model any new non-transaction/settings resource on this shape, not on the store's dual-write pattern.

## Dead / unreachable code — do not assume these are live

- **`pages/BudgetsPage.tsx`** and **`pages/RecurringPage.tsx`** exist and compile but are never imported by `Index.tsx` or anywhere else. The `'budgets'` tab (`TabId`, `types/index.ts`) actually renders `EnvelopesPage`, not `BudgetsPage`. The `'recurring_tx'` `TabId` value exists in the union but has no branch in `Index.tsx` and no nav entry anywhere — selecting it (if ever set) would render nothing. The `'recurring'` tab renders `RecurringTransactionsPage`, not `RecurringPage`.
- The **"recurring rules"** API surface in `lib/api.ts` (`fetchRecurringRules`/`createRecurringRule`/etc., hitting `/api/recurring`) is only consumed by the orphaned `RecurringPage.tsx`. The live recurring feature uses the separate `/api/recurring-transactions` functions instead. See `paisaPalAPI/CLAUDE.md` for how these map to the same backend collection under the hood.
- The **"budgets"** API surface (`fetchBudgets`/`createBudget`/etc., hitting `/api/budgets`) is only consumed by the orphaned `BudgetsPage.tsx`, plus `fetchBudgets`/`fetchBudgetStats` are still called from `SettingsPage.tsx#shareSnapshot()` to embed budget data into a snapshot link.
- `components/ui/chart.tsx` and `components/ui/sidebar.tsx` (shadcn-generated primitives) are not imported anywhere — dashboard charts are hand-rolled Recharts per component, and the real nav sidebar is `components/layout/Sidebar.tsx`.
- `components/NavLink.tsx` is unused (see routing section above).

## Testing

Vitest (`jsdom`, `src/test/setup.ts`) — currently only `src/test/example.test.ts` exists as a real test; there is no meaningful unit-test coverage of stores/hooks/components yet, so be extra careful verifying changes there manually (start `npm run dev` and exercise the flow) rather than trusting `npm test` to catch regressions. Playwright config extends `lovable-agent-playwright-config` (no local `playwright.config.ts` overrides currently set beyond commented-out examples).

## Other conventions worth knowing

- **Date-key fallback**: components bucketing by day repeat the pattern `t.dateKey || toLocalDateKey(t.date)` rather than trusting `dateKey` to always be populated — do the same in new code touching transaction dates.
- `CategoryModeSplit.tsx`'s Online/Cash stacked chart lumps `Card` transactions into the `Cash` bucket (its `else` branch catches anything that isn't `Online`) — likely an oversight, not an intentional design choice; be aware of it if asked to fix mode-split accuracy anywhere.
- `BudgetRing.tsx` has an unused `timeoutRef` (dead debounce scaffolding) — harmless but don't assume it does anything.
