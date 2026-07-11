# PaisaPal — Project Context

> **Last updated:** 2026-07-11  
> Generated to reflect the codebase state *after* the `dashboard-enhancements` spec was implemented.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Backend — `paisaPalAPI`](#3-backend--paisapalapi)
4. [Frontend — `paisaPalFrontend`](#4-frontend--paisapalfrontend)
5. [Data Models](#5-data-models)
6. [State Management (Zustand Store)](#6-state-management-zustand-store)
7. [Dashboard Utilities (`dashboardUtils.ts`)](#7-dashboard-utilities-dashboardutilitsts)
8. [Key Pages & Components](#8-key-pages--components)
9. [Feature: Dashboard Enhancements (implemented)](#9-feature-dashboard-enhancements-implemented)
10. [API Contract Summary](#10-api-contract-summary)
11. [Conventions & Patterns](#11-conventions--patterns)

---

## 1. Project Overview

**PaisaPal** is a personal expense tracker built for Indian users (₹ currency). It supports:

- Manual transaction entry with categories, payment modes, and notes
- Bulk CSV import / CSV export
- Dashboard with rich analytics widgets (daily trend, spending heatmap, category donut, etc.)
- Recurring transaction rules and auto-generation
- Savings goals with contributions
- Budget envelopes per category per month
- Offline-first mode with server sync
- Snapshot / read-only view mode

**Stack:** Node.js (Express + TypeScript) backend on MongoDB, React 18 + Vite frontend in TypeScript, Zustand for client state, Recharts for visualisations, framer-motion for animations, TailwindCSS for styling, Lucide for icons.

---

## 2. Monorepo Structure

```
paisaPal/
├── paisaPalAPI/          # Express/Node API
│   ├── src/
│   │   ├── controllers/  # Route handlers (auth, transactions, budgets, savings, …)
│   │   ├── models/       # Mongoose models
│   │   ├── routes/       # Express router registration
│   │   ├── services/     # Business logic (sync, recurring, etc.)
│   │   ├── middleware/   # Auth, error handler
│   │   ├── schemas/      # Zod request schemas
│   │   └── lib/          # Shared utilities (dateKey helpers, etc.)
│   ├── tests/            # Vitest API tests
│   └── vitest.config.ts
│
├── paisaPalFrontend/     # React + Vite SPA
│   ├── src/
│   │   ├── pages/        # Full-page route components
│   │   ├── components/
│   │   │   ├── dashboard/       # All dashboard widgets
│   │   │   ├── transactions/    # TransactionForm, BulkImport
│   │   │   ├── layout/          # Navigation shell
│   │   │   └── ui/              # Shared primitives
│   │   ├── store/index.ts        # Zustand store (single file)
│   │   ├── stores/syncStore.ts   # Sync/online status store
│   │   ├── lib/
│   │   │   ├── api.ts            # All fetch() calls to the API
│   │   │   ├── dashboardUtils.ts # Pure computation helpers
│   │   │   ├── utils.ts          # formatCurrency, formatDate, toLocalDateKey, …
│   │   │   └── idbStorage.ts     # IndexedDB offline persistence
│   │   └── types/index.ts        # All shared TypeScript types
│   └── vite.config.ts
│
└── .kiro/specs/          # Kiro feature specs
    └── dashboard-enhancements/
        ├── requirements.md
        ├── design.md
        └── tasks.md
```

---

## 3. Backend — `paisaPalAPI`

### Tech Stack
- **Runtime:** Node.js 20 with TypeScript (`ts-node` / compiled to `dist/`)
- **Framework:** Express 4
- **Database:** MongoDB via Mongoose
- **Auth:** JWT (access + refresh tokens), stored in `User.refreshTokens[]`
- **Validation:** Zod schemas at controller boundary
- **Tests:** Vitest with Supertest

### Routes (`src/routes/`)

| File | Mounted at | Purpose |
|---|---|---|
| `auth.ts` | `/api/auth` | Register, login, refresh, logout |
| `transactions.ts` | `/api/transactions` | CRUD + paginated list + CSV export |
| `budgets.ts` | `/api/budgets` | Monthly budget CRUD |
| `envelopes.ts` | `/api/envelopes` | Envelope budget per month |
| `savings.ts` | `/api/savings` | Goals + contributions |
| `recurring.ts` | `/api/recurring` | Recurring rules |
| `recurringTransactions.ts` | `/api/recurring-transactions` | Auto-generated recurring txs |
| `settings.ts` | `/api/settings` | User settings (stipend, extras, category config) |
| `stats.ts` | `/api/stats` | Aggregate stats endpoint |
| `sync.ts` | `/api/sync` | Full offline-sync pull/push |
| `audit.ts` | `/api/audit` | Audit log read |

### Key API Endpoints

```
GET  /api/transactions?page=&limit=&sort=&order=&search=&category=&mode=&startDate=&endDate=&minAmount=&maxAmount=&hasNotes=
POST /api/transactions
PUT  /api/transactions/:id
DELETE /api/transactions/:id
POST /api/transactions/bulk-delete
GET  /api/transactions/export/csv

GET  /api/sync/pull          → returns full dataset for offline use
POST /api/sync/push          → applies batched offline mutations

GET  /api/settings
PUT  /api/settings

GET  /api/stats?month=YYYY-MM
```

### `dateKey` Convention
All transaction dates are stored in two fields:
- `date: Date` — raw JS Date (UTC)
- `dateKey: string` — `YYYY-MM-DD` in **Asia/Kolkata** timezone, used for all calendar lookups

Every date comparison in both API and frontend uses `dateKey` (or falls back to `toLocalDateKey(t.date)`).

---

## 4. Frontend — `paisaPalFrontend`

### Tech Stack
- **Framework:** React 18 + Vite + TypeScript
- **Routing:** Single-page; tabs managed by Zustand `activeTab` state (no URL router)
- **State:** Zustand (one main store, one sync status store)
- **Charts:** Recharts (`AreaChart`, `PieChart`, etc.)
- **Animations:** framer-motion (`motion.div`, `AnimatePresence`)
- **Icons:** lucide-react
- **Styling:** TailwindCSS with CSS custom properties for theme tokens (`--primary`, `--muted-foreground`, `--border`, etc.)
- **Offline persistence:** IndexedDB via `idbStorage.ts`

### Path Aliases (`@/`)
All `@/` imports resolve to `src/` (configured in `vite.config.ts`).

### CSS Design Tokens (used throughout)
```
hsl(var(--primary))          – accent / brand colour
hsl(var(--muted-foreground)) – secondary text
hsl(var(--border))           – dividers
hsl(var(--secondary))        – subtle backgrounds
hsl(var(--foreground))       – primary text
hsl(var(--card))             – card background
hsl(var(--danger))           – destructive red (custom token)
```
All dashboard cards use the `.card-base` CSS class.

---

## 5. Data Models

### Transaction
```typescript
interface Transaction {
  id: string          // MongoDB _id
  date: string        // ISO date string
  dateKey: string     // "YYYY-MM-DD" (IST)
  particulars: string // description
  amount: number      // in ₹, always positive
  category: Category  // string (one of DEFAULT_CATEGORIES or custom)
  mode: 'Online' | 'Cash' | 'Card'
  notes: string       // optional free-text; empty string when absent
  createdAt: string
  updatedAt: string
}
```

### Stats (computed client-side)
```typescript
interface Stats {
  totalSpent: number
  byCategory: { category: Category; total: number; count: number }[]
  byDate: { date: string; total: number }[]   // date = "YYYY-MM-DD" or "YYYY-MM" in yearly mode
  byMode: { Online: number; Cash: number; Card: number }
  transactionCount: number
  activeDays: number
  dailyAverage: number
  biggestDay: { date: string; total: number }
  biggestTransaction: Transaction | null
  rapidoStats: { total: number; count: number; avgPerRide: number }
}
```

### Settings
```typescript
interface Settings {
  stipend: number
  extra: number
  categoryConfig?: { name: string; color: string }[]
  rapidoTaxEnabled?: boolean
  rapidoTaxPercent?: number
  primarySavingsGoalId?: string
  monthEndReminderEnabled?: boolean
  envelopeWarningThreshold?: number
}
```

### Default Categories
`Rapido | Bus/GSRTC | Food & Drinks | Shopping | Social | Recharge/Bills | Self Care | Transfer/Sent | Other`

Custom categories can be added via `Settings.categoryConfig[]`.

---

## 6. State Management (Zustand Store)

**File:** `src/store/index.ts` (single large store, ~600 lines)

### Key Slices

| State | Type | Description |
|---|---|---|
| `transactions` | `Transaction[]` | Full transaction list (all time) |
| `transactionRevision` | `number` | Incremented on any mutation; triggers paginated refetches |
| `settings` | `Settings` | User settings |
| `activeTab` | `TabId` | Current navigation tab |
| `formOpen` | `boolean` | Transaction form open/close |
| `editingTransaction` | `Transaction \| null` | Transaction being edited |
| `isSnapshotView` | `boolean` | Read-only mode (no mutations) |

### Key Actions
- `openForm(tx?)` — opens TransactionForm, optionally pre-filling for edit
- `removeTransaction(id)` — deletes single transaction
- `bulkRemoveTransactions(ids[])` — bulk delete
- `repeatTransaction(tx)` — opens form pre-filled with a copy of `tx`
- `syncFromServer()` — pulls full dataset from `/api/sync/pull`

### Sync Store (`src/stores/syncStore.ts`)
- `isOnline: boolean` — tracks navigator.onLine
- Used throughout to decide API vs offline path

---

## 7. Dashboard Utilities (`dashboardUtils.ts`)

**File:** `src/lib/dashboardUtils.ts`

All functions are pure (no side effects) and operate on `Transaction[]`.

```typescript
// Sorted newest-first list of "YYYY-MM" strings that have at least one transaction
getAvailableMonths(transactions: Transaction[]): string[]

// Filter to one month + day-type
filterTransactions(transactions, month: string, dayFilter: DayFilter): Transaction[]

// Compute Stats from any set of transactions (returns null if empty)
computeFilteredStats(transactions: Transaction[]): Stats | null

// Compute per-month metrics (totalSpend, byCategory, etc.) for one month
computeMonthMetrics(transactions, month: string): MonthMetrics

// NEW (dashboard-enhancements): Always returns exactly 12 data points for the year
// Pre-populates Jan–Dec with 0, then sums in matching transactions
computeYearlyTrend(transactions, year: number): YearlyTrendPoint[]
//   YearlyTrendPoint = { date: "YYYY-MM"; total: number }
```

**`DayFilter`** type (exported from `DashboardFilters.tsx`): `'all' | 'weekday' | 'weekend'`

---

## 8. Key Pages & Components

### Pages (`src/pages/`)

| File | Tab | Description |
|---|---|---|
| `DashboardPage.tsx` | `dashboard` | Main analytics dashboard |
| `TransactionsPage.tsx` | `transactions` | Paginated table + mobile card list |
| `BudgetsPage.tsx` | `budgets` | Monthly budget management |
| `InsightsPage.tsx` | `insights` | Deep analytics and reports |
| `SavingsPage.tsx` | `savings` | Savings goals |
| `EnvelopesPage.tsx` | `envelopes` | Envelope budgeting |
| `RecurringPage.tsx` | `recurring` | Recurring rules |
| `RecurringTransactionsPage.tsx` | `recurring_tx` | Auto-generated recurring txs |
| `SettingsPage.tsx` | `settings` | App settings |

### Dashboard Components (`src/components/dashboard/`)

| Component | Props | Description |
|---|---|---|
| `DashboardFilters` | dayFilter, viewMode, selectedYear, … | Month/Year toggle, month navigator, day filter, category filter |
| `DailyTrend` | `stats: Stats \| null` | Area chart of `stats.byDate` (daily in monthly mode, monthly-bucketed in yearly mode) |
| `CumulativeSpend` | `stats, budget` | Running total area chart |
| `CategoryDonut` | `stats` | Pie chart by category |
| `TopCategories` | `stats` | Ranked bar list |
| `AvgTransactionByCategory` | `stats` | Avg transaction value per category |
| `CategoryModeSplit` | `transactions` | Online/Cash/Card breakdown per category |
| `QuickStats` | `stats` | Summary stat cards |
| `RecentTransactions` | `transactions` | Last N transactions list |
| `SpendingHeatmap` | `transactions, dayFilter` | Day-of-week vs amount heatmap |
| `WeeklySpendingHeatmap` | `transactions, dayFilter` | Week-by-week heatmap |
| `WeeklySpendSummary` | `transactions` | Weekly spend bar chart |
| `SpendingCalendar` | `transactions, selectedMonth` | Calendar heat map (**monthly mode only**) |
| `BudgetRing` | `stats` | Budget utilisation ring (**monthly mode only**) |
| `MonthlyComparison` | *(reads store)* | Month-to-month side-by-side (**monthly mode only**) |
| **`MonthTrendSparkline`** | *(reads store directly)* | **NEW** — 6-month spend trend AreaChart with TrendIndicator (**monthly mode only**) |

---

## 9. Feature: Dashboard Enhancements (implemented)

Three pure-frontend features, no API or schema changes. All implemented in the `dashboard-enhancements` spec.

### 9.1 Transaction Notes Quick-View

**Files changed:** `TransactionsPage.tsx`

- Added `expandedNoteIds: Set<string>` local state and `toggleNote(id)` callback.
- **Desktop:** The "Notes" column now renders a `ChevronDown` button (with 180° rotation when expanded) instead of the static truncated text. An animated `<motion.tr>` expand row appears below each row when that transaction's notes panel is open, showing full `notes` text with `whitespace-pre-wrap` in a `bg-secondary/60` block.
- **Mobile:** A "Notes" chevron button appears below the card actions. Tapping it toggles an `<AnimatePresence>` / `<motion.div>` panel with the same styling.
- Multiple rows can be expanded simultaneously.
- Filtering / pagination resets the visible set, naturally collapsing orphaned expanded IDs.

### 9.2 Month-over-Month Trend Sparkline

**Files changed / created:**
- `src/lib/dashboardUtils.ts` — `computeMonthMetrics` was already present; sparkline uses it directly.
- `src/components/dashboard/MonthTrendSparkline.tsx` — **new file**

**Behaviour:**
- Reads `transactions` directly from the Zustand store (bypasses dashboard filters).
- Uses `getAvailableMonths` → takes last 6 → reverses to oldest-first.
- Computes `totalSpend` per month via `computeMonthMetrics`.
- Renders a Recharts `AreaChart` with `hsl(var(--primary))` stroke and gradient fill.
- Shows a `TrendIndicator` above the chart: `TrendingUp` (red) or `TrendingDown` (green) icon + "X% vs [oldest month]".
- Falls back to "No baseline" if oldest total is 0, or shows an empty-state message if fewer than 2 months exist.
- **Placement:** Full-width row between ROW 1 (DailyTrend + CumulativeSpend) and the category grid. **Rendered only in `viewMode === 'monthly'`.**

### 9.3 Yearly Dashboard View

**Files changed:**
- `src/components/dashboard/DashboardFilters.tsx` — extended `Props`; added ViewMode pill toggle + YearSelector
- `src/pages/DashboardPage.tsx` — added yearly state; all widgets now use `activeStats` / `activeTxs`
- `src/lib/dashboardUtils.ts` — added `computeYearlyTrend` + `YearlyTrendPoint` type

**New state in `DashboardPage`:**
```typescript
const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly')
const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear())
const availableYears = useMemo(…)  // distinct years from transactions
const yearlyTxs   = useMemo(…)     // filtered by selectedYear when viewMode === 'yearly'
const yearlyStats = useMemo(…)     // computeFilteredStats(yearlyTxs)
const yearlyTrendStats = useMemo(…) // yearlyStats with byDate replaced by computeYearlyTrend output
const activeStats = viewMode === 'yearly' ? yearlyStats : filteredStats
const activeTxs   = viewMode === 'yearly' ? yearlyTxs   : filteredTxs
```

**DashboardFilters new props:**
```typescript
viewMode: 'monthly' | 'yearly'
setViewMode: (m: 'monthly' | 'yearly') => void
selectedYear: number
setSelectedYear: (y: number) => void
availableYears: number[]
```

**Hidden in yearly mode:** `BudgetRing`, `MonthlyComparison`, `SpendingCalendar`, `MonthTrendSparkline`  
**DailyTrend in yearly mode:** receives `yearlyTrendStats` (byDate has 12 monthly-bucketed points)

**Monthly state preservation:** `selectedMonth`, `dayFilter`, `selectedCategories` are never reset when switching modes — toggling back restores them automatically.

---

## 10. API Contract Summary

### Authentication
All routes except `/api/auth/*` require `Authorization: Bearer <accessToken>`.

### Transactions Pagination
```
GET /api/transactions
  Query: page (default 1), limit (default 50), sort, order, search, category, mode,
         startDate, endDate, minAmount, maxAmount, hasNotes (true/false)
  Response: { transactions: ITransaction[], total, page, pages }
```

### Sync (offline-first)
```
GET  /api/sync/pull → { transactions[], settings, budgets, savings, envelopes, recurringRules, recurringTransactions }
POST /api/sync/push → { mutations: MutationLog[] } → { results[] }
```

---

## 11. Conventions & Patterns

### Date Handling
- Always use `dateKey` (`YYYY-MM-DD`, IST) for comparisons, never raw `date`.
- Use `toLocalDateKey(date)` from `@/lib/utils` to generate `dateKey` client-side.
- Month keys are `YYYY-MM` (first 7 chars of `dateKey`).

### Component Patterns
- All dashboard widgets receive `stats: Stats | null` and/or `transactions: Transaction[]` as props (except `MonthTrendSparkline` and `MonthlyComparison` which read the store directly).
- Stagger animations use the `container` / `item` motion variant pattern from `DashboardPage`.
- Cards always use the `.card-base p-5` pattern.
- Empty states: `<div className="py-12 text-center text-muted-foreground">…</div>`

### Offline / Online Branching
```typescript
const effectiveOnline = isOnline && !isSnapshotView
// TransactionsPage:
const filtered = effectiveOnline ? pageTransactions : isSnapshotView ? pageTransactions : offlineFiltered
```

### Error Handling
- All async operations use `getUserError(err, fallbackMsg)` → `toast.error(formatToastMessage(u))`
- API errors go through `formatToastMessage` for user-friendly display.

### Import Alias
All internal imports use `@/` which resolves to `src/`.

### No New Dependencies
The dashboard-enhancements spec used only existing packages: Recharts, framer-motion, lucide-react, Zustand. No new `npm install` was required.
