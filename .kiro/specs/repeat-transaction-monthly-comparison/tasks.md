# Implementation Plan: Repeat Transaction & Monthly Comparison

## Overview

Two frontend-only features built on top of the existing Zustand store, Recharts, and vitest setup. Tasks are sequenced so each step integrates immediately — no orphaned code.

`fast-check` is added as a dev dependency in task 1 and used for property-based tests throughout.

## Tasks

- [x] 1. Install fast-check and add `computeMonthMetrics` to dashboardUtils
  - [x] 1.1 Add `fast-check` dev dependency to `paisaPalFrontend/package.json` and install it
    - Run `npm install --save-dev fast-check@^3` inside `paisaPalFrontend/`
    - _Requirements: (prerequisite for all property tests)_

  - [x] 1.2 Add `computeMonthMetrics` and `MonthMetrics` to `src/lib/dashboardUtils.ts`
    - Export `MonthMetrics` interface: `{ month, totalSpend, byCategory, dailyAverage, transactionCount, byMode, topCategory }`
    - Implement `computeMonthMetrics(transactions: Transaction[], month: string): MonthMetrics` — filter by `dateKey || toLocalDateKey(date)` prefix, compute all six metrics per the design
    - _Requirements: 3.1, 3.4, 3.5, 3.6_

  - [ ]* 1.3 Write property tests for `computeMonthMetrics` (Properties 5, 6, 7)
    - Create `src/test/computeMonthMetrics.test.ts`
    - Use `fc.array(arbitraryTransaction({ month }))` as generator
    - **Property 5: totalSpend equals arithmetic sum of amounts**
    - **Validates: Requirements 3.1, 3.4**
    - **Property 6: dailyAverage equals totalSpend / count of distinct dateKey values; 0 when no transactions**
    - **Validates: Requirements 3.1, 3.5**
    - **Property 7: byCategory[c] equals sum of amounts for transactions with category === c**
    - **Validates: Requirements 3.1, 3.6**
    - Tag each test with `// Feature: repeat-transaction-monthly-comparison, Property N: <text>`
    - `{ numRuns: 100 }`

- [x] 2. Implement `repeatTransaction` in the Zustand store
  - [x] 2.1 Add `repeatTransaction` action to `src/store/index.ts`
    - Add `repeatTransaction: (tx: Transaction) => void` to `AppStore` interface
    - Implement: compute `today = toLocalDateKey(new Date())`, call `get().openForm({ ...tx, id: undefined as unknown as string, date: today, dateKey: today })`
    - _Requirements: 1.1, 1.8_

  - [ ]* 2.2 Write property test for `repeatTransaction` (Property 1)
    - Add to `src/test/repeatTransaction.test.ts`
    - Use `fc.record({ id: fc.string(), particulars: fc.string(), amount: fc.float({ min: 0 }), ... })` as arbitrary transaction generator
    - **Property 1: repeatTransaction strips id and sets date to today, preserving all other fields**
    - **Validates: Requirements 1.1, 1.8**
    - `{ numRuns: 100 }`

- [x] 3. Update `TransactionForm` repeat-mode detection
  - [x] 3.1 Change `isEditing` check in `src/components/transactions/TransactionForm.tsx`
    - Replace `const isEditing = !!editingTransaction` with `const isEditing = !!(editingTransaction?.id)`
    - Verify title shows "Add Transaction", submit button shows "Add Transaction", and `addTransaction` (not `updateTransaction`) is called when `editingTransaction` has no `id`
    - _Requirements: 1.4, 1.5, 1.6_

  - [ ]* 3.2 Write unit tests for TransactionForm repeat mode
    - Add to `src/test/TransactionForm.test.tsx`
    - Test: title is "Add Transaction" when `editingTransaction` has no `id` but has pre-filled fields (Requirement 1.5)
    - Test: `addTransaction` is called on submit, `updateTransaction` is not (Requirement 1.6)
    - Test: form fields are pre-populated from `editingTransaction` and date is today (Requirement 1.4)
    - _Requirements: 1.4, 1.5, 1.6_

- [x] 4. Add RepeatAction button to `TransactionsPage`
  - [x] 4.1 Add repeat button to desktop table and mobile card in `src/pages/TransactionsPage.tsx`
    - Import `repeatTransaction` and `isSnapshotView` from `useStore`
    - Import `CopyPlus` from `lucide-react`
    - Desktop: add `<button onClick={() => repeatTransaction(tx)} aria-label="Repeat transaction" disabled={isSnapshotView}>` between Edit and Delete in the actions `<td>`, in the non-deleting state only
    - Mobile card: add equivalent `<button>` with `aria-label="Repeat"` in the non-deleting state
    - Both buttons: `disabled={isSnapshotView}` with `disabled:opacity-40 disabled:cursor-not-allowed` classes
    - _Requirements: 1.2, 1.3, 1.7_

  - [ ]* 4.2 Write property test for RepeatAction disabled state (Property 3)
    - Add to `src/test/repeatTransaction.test.ts`
    - **Property 3: RepeatAction button has disabled attribute for any transaction when isSnapshotView is true**
    - **Validates: Requirement 1.7**
    - `{ numRuns: 100 }`

  - [ ]* 4.3 Write property test for RepeatAction invocation (Property 2)
    - Add to `src/test/repeatTransaction.test.ts`
    - **Property 2: clicking RepeatAction for transaction tx calls repeatTransaction with exactly tx**
    - **Validates: Requirements 1.2, 1.3**
    - `{ numRuns: 100 }`

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create `MonthlyComparison` component
  - [x] 6.1 Create `src/components/dashboard/MonthlyComparison.tsx`
    - Read `transactions` directly from `useStore` (not from props)
    - Derive `allMonths` via `getAvailableMonths(transactions)`
    - Default selection: 2 most recent months if ≥2 exist, otherwise all available months
    - Internal state: `selectedMonths: string[]`, `activeMetric: MetricTab`
    - `type MetricTab = 'totalSpend' | 'byCategory' | 'dailyAverage' | 'transactionCount' | 'byMode'`
    - _Requirements: 2.1, 2.2, 2.3, 5.2_

  - [x] 6.2 Implement month picker with 2–3 selection constraint
    - Render month toggle buttons for each available month derived from `allMonths`
    - `toggleMonth(m)`: ignore deselect if `prev.length <= 2`; ignore select if `prev.length >= 3`
    - _Requirements: 2.4, 2.5, 2.6_

  - [ ]* 6.3 Write property test for month selection constraints (Property 4)
    - Add to `src/test/MonthlyComparison.test.ts`
    - **Property 4: for any sequence of toggleMonth calls starting from a valid 2–3 month selection, selectedMonths always has length between 2 and 3**
    - **Validates: Requirements 2.4, 2.5, 2.6**
    - `{ numRuns: 100 }`

  - [x] 6.4 Implement metric tabs and grouped bar chart
    - Render tabs: Total Spend, By Category, Daily Average, Transaction Count, Mode Split
    - Compute `metrics = selectedMonths.map(m => computeMonthMetrics(transactions, m))`
    - For scalar metrics (`totalSpend`, `dailyAverage`, `transactionCount`): shape data as `[{ month, value }]` with one `<Bar dataKey="value" />`
    - For `byCategory`: pivot to `[{ category, [monthLabel]: number }]` with one `<Bar>` per selected month
    - For `byMode`: same pivot structure with `Online`, `Cash`, `Card` as row keys
    - Use Recharts `<BarChart>` / `<Bar>` / `<XAxis>` / `<YAxis>` / `<Tooltip>` / `<Legend>` / `<ResponsiveContainer>`
    - Update chart data when selected months or active metric changes (no page reload)
    - _Requirements: 3.2, 3.3, 4.1, 4.2_

  - [x] 6.5 Implement SummaryRow below the chart
    - For scalar metrics only (`totalSpend`, `dailyAverage`, `transactionCount`) and when `selectedMonths.length >= 2`:
      - Identify cheapest month (`Math.min` of scalar values) and most expensive
      - Compute `pct = Math.round((max - min) / max * 100)`
      - Render: "YYYY-MM was X% cheaper than YYYY-MM for [metric]"
    - Suppress SummaryRow when `selectedMonths.length < 2` or active metric is `byCategory` / `byMode`
    - _Requirements: 4.3, 4.4, 4.5_

  - [ ]* 6.6 Write unit tests for `MonthlyComparison`
    - Add to `src/test/MonthlyComparison.test.ts`
    - Test: default selection is 2 most recent months when ≥2 months of data exist (Requirement 2.2)
    - Test: default selection is all months when <2 months of data exist (Requirement 2.3)
    - Test: SummaryRow is absent when only 1 month selected (Requirement 4.5)
    - Test: SummaryRow percentage matches formula `Math.round((max - min) / max * 100)` (Requirement 4.4)
    - Test: widget uses store transactions, not filtered props (Requirement 5.2)
    - _Requirements: 2.2, 2.3, 4.4, 4.5, 5.2_

  - [ ]* 6.7 Write property test for SummaryRow percentage formula (Property 8)
    - Add to `src/test/MonthlyComparison.test.ts`
    - **Property 8: for any two months A and B with vA < vB, rendered SummaryRow percentage equals Math.round((vB - vA) / vB * 100)**
    - **Validates: Requirement 4.4**
    - `{ numRuns: 100 }`

- [x] 7. Integrate `MonthlyComparison` into `DashboardPage`
  - [x] 7.1 Add `MonthlyComparison` as the last widget in `src/pages/DashboardPage.tsx`
    - Import `MonthlyComparison` from `@/components/dashboard/MonthlyComparison`
    - Append `<motion.div variants={item}><MonthlyComparison /></motion.div>` after the last existing grid row, inside the outer `<motion.div>` but outside the `noData` guard
    - Pass no props — the component reads `transactions` from the store directly
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 7.2 Write unit test for DashboardPage integration
    - Add to `src/test/DashboardPage.test.tsx`
    - Test: `MonthlyComparison` is rendered as the last section in `DashboardPage`
    - Test: changing `selectedMonth` or category filter in DashboardPage does not affect MonthlyComparison's available months or metrics
    - _Requirements: 5.1, 5.3_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- `fast-check` must be installed (task 1.1) before any property tests are run
- `computeMonthMetrics` (task 1.2) must exist before the MonthlyComparison component is built (task 6)
- The `isEditing` fix in task 3.1 is the only change needed in `TransactionForm.tsx`
- `MonthlyComparison` never receives `filteredTxs` or `filteredStats` as props — it always reads the full store
- Property tests reference the design document property numbers for traceability
