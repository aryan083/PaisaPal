# Requirements Document

## Introduction

This document covers two frontend-only features for the PaisaPal expense tracker:

1. **Repeat Transaction** — a quick-repeat action on any existing transaction that opens the Add Transaction form pre-filled with the source transaction's data (particulars, amount, category, mode, notes) but with today's date, letting the user confirm and save it as a brand-new transaction.

2. **Monthly Comparison Dashboard Widget** — a new dashboard section that lets the user pick 2–3 months and compare spending side-by-side across multiple metrics (total spend, per-category spend, daily average, transaction count, payment mode split, and top category), visualised as a grouped bar chart with a plain-language summary row.

Both features are pure frontend changes. No API changes, schema changes, or new dependencies are required (Recharts is already in use).

---

## Glossary

- **TransactionsPage**: The page component at `src/pages/TransactionsPage.tsx` that lists all transactions.
- **TransactionForm**: The slide-over sheet component at `src/components/transactions/TransactionForm.tsx` used to add or edit a transaction.
- **Store**: The Zustand store at `src/store/index.ts` that holds application state and actions.
- **RepeatAction**: The UI affordance (button) on a transaction row or card that triggers the repeat-transaction flow.
- **RepeatedTransaction**: A new transaction pre-filled from a source transaction with a different date and no id.
- **DashboardPage**: The page component at `src/pages/DashboardPage.tsx` that renders all dashboard widgets.
- **MonthlyComparisonWidget**: The new dashboard component at `src/components/dashboard/MonthlyComparison.tsx`.
- **ComparisonMonth**: A calendar month (YYYY-MM string) selected by the user for side-by-side comparison.
- **ComparisonMetric**: One of the six computed values used for month-over-month comparison: total spend, per-category spend, daily average spend, transaction count, payment mode split, or top category.
- **SummaryRow**: A plain-language sentence below the chart describing the largest spending delta between the selected months.
- **SnapshotView**: A read-only mode (`isSnapshotView = true` in the Store) where data mutation actions are disabled.

---

## Requirements

### Requirement 1: Repeat Transaction Action

**User Story:** As a user, I want to repeat an existing transaction with a single click, so that I can quickly log a recurrence of a past purchase without re-entering all the details manually.

#### Acceptance Criteria

1. THE Store SHALL expose a `repeatTransaction(tx: Transaction)` action that calls `openForm` with a copy of `tx` where the `id` field is `undefined` and the `date` field is set to today's local date in `YYYY-MM-DD` format.

2. WHEN the user clicks the RepeatAction button on a transaction row in the desktop table, THE TransactionsPage SHALL call `repeatTransaction` with that transaction.

3. WHEN the user clicks the RepeatAction button on a transaction card in the mobile layout, THE TransactionsPage SHALL call `repeatTransaction` with that transaction.

4. WHEN `openForm` is called with an object that has no `id` but has pre-filled `particulars`, `amount`, `category`, `mode`, or `notes` values, THE TransactionForm SHALL populate the form fields with those values and set `date` to today's local date.

5. WHEN the TransactionForm is open in repeat mode (pre-filled, no `editingTransaction.id`), THE TransactionForm SHALL display the title "Add Transaction" (not "Edit Transaction").

6. WHEN the user submits the TransactionForm in repeat mode, THE TransactionForm SHALL create a new transaction via `addTransaction` (not `updateTransaction`), preserving all pre-filled field values and the today date.

7. WHILE `isSnapshotView` is `true`, THE TransactionsPage SHALL render the RepeatAction button in a disabled state.

8. FOR ANY transaction `tx` in the Store, calling `repeatTransaction(tx)` SHALL result in `editingTransaction` having `particulars`, `amount`, `category`, `mode`, and `notes` equal to the corresponding fields of `tx`, and `date` equal to today's local date, and no `id` field set.

---

### Requirement 2: Monthly Comparison Widget — Month Selection

**User Story:** As a user, I want to select 2 or 3 months to compare side-by-side, so that I can understand how my spending has changed over time.

#### Acceptance Criteria

1. THE MonthlyComparisonWidget SHALL derive the list of available months from the full `transactions` array in the Store, independent of any filters applied on the DashboardPage.

2. WHEN the MonthlyComparisonWidget first renders and at least 2 months of transaction data exist, THE MonthlyComparisonWidget SHALL default to selecting the 2 most recent months.

3. WHEN the MonthlyComparisonWidget first renders and fewer than 2 months of transaction data exist, THE MonthlyComparisonWidget SHALL select all available months.

4. THE MonthlyComparisonWidget SHALL render a multi-select month picker that allows the user to select between 2 and 3 ComparisonMonths.

5. IF the user attempts to deselect a ComparisonMonth that would leave fewer than 2 ComparisonMonths selected, THEN THE MonthlyComparisonWidget SHALL ignore the deselection and keep the current selection unchanged.

6. IF the user attempts to select a 4th ComparisonMonth, THEN THE MonthlyComparisonWidget SHALL ignore the selection and keep the current 3-month selection unchanged.

---

### Requirement 3: Monthly Comparison Widget — Metrics

**User Story:** As a user, I want to see multiple spending metrics compared across my selected months, so that I can identify patterns and differences in my financial behaviour.

#### Acceptance Criteria

1. THE MonthlyComparisonWidget SHALL compute the following ComparisonMetrics for each selected ComparisonMonth from the transactions whose `dateKey` or `date` falls within that month:
   - Total spend (sum of all `amount` values)
   - Per-category spend (sum of `amount` grouped by `category`)
   - Daily average spend (total spend divided by the number of calendar days in the month that have at least one transaction)
   - Transaction count (total number of transactions)
   - Payment mode split (sum of `amount` for each of `Online`, `Cash`, and `Card`)
   - Top category (the category with the highest total spend)

2. THE MonthlyComparisonWidget SHALL render metric tabs allowing the user to switch between: Total Spend, By Category, Daily Average, Transaction Count, and Mode Split views.

3. WHEN the user selects a metric tab, THE MonthlyComparisonWidget SHALL update the grouped bar chart to display that ComparisonMetric for each selected ComparisonMonth.

4. FOR ANY set of transactions belonging to a given ComparisonMonth, the total spend metric SHALL equal the arithmetic sum of the `amount` field across all transactions in that month.

5. FOR ANY set of transactions belonging to a given ComparisonMonth, the daily average spend metric SHALL equal the total spend divided by the count of distinct `dateKey` values (days with at least one transaction) in that month.

6. FOR ANY set of transactions belonging to a given ComparisonMonth, the per-category spend for each category SHALL equal the sum of `amount` for all transactions in that month whose `category` matches.

---

### Requirement 4: Monthly Comparison Widget — Visualisation

**User Story:** As a user, I want to see a grouped bar chart with a plain-language summary, so that I can quickly grasp the biggest differences between my selected months at a glance.

#### Acceptance Criteria

1. THE MonthlyComparisonWidget SHALL render a grouped bar chart using the Recharts library, with one bar group per ComparisonMonth and one bar per data series (e.g. per category when "By Category" is selected, or a single bar per month for scalar metrics).

2. WHEN the set of selected ComparisonMonths changes, THE MonthlyComparisonWidget SHALL update the chart data without requiring a page reload.

3. THE MonthlyComparisonWidget SHALL render a SummaryRow below the chart that identifies the cheapest ComparisonMonth for the currently active metric and states the percentage difference relative to the most expensive selected month.

4. FOR ANY two ComparisonMonths A and B with total spends `spendA` and `spendB` where `spendA < spendB`, the SummaryRow percentage difference SHALL equal `Math.round((spendB - spendA) / spendB * 100)` percent.

5. WHEN only one ComparisonMonth is selected (edge case: all others deselected), THE MonthlyComparisonWidget SHALL not render a SummaryRow comparative sentence, since comparison requires at least 2 months.

---

### Requirement 5: Monthly Comparison Widget — Dashboard Integration

**User Story:** As a user, I want the Monthly Comparison widget to always show me full historical data, so that the comparison is not skewed by the dashboard's current month or category filters.

#### Acceptance Criteria

1. THE DashboardPage SHALL render the MonthlyComparisonWidget as the last section, after all other existing dashboard widgets.

2. THE MonthlyComparisonWidget SHALL read transaction data directly from the Store's full `transactions` array and SHALL NOT use the `filteredTxs` or `filteredStats` values computed by the DashboardPage.

3. WHEN the user changes the DashboardPage month filter or category filter, THE MonthlyComparisonWidget's available months and computed metrics SHALL remain unchanged.
