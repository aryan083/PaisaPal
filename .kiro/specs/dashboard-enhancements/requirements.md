# Requirements Document

## Introduction

This document covers three pure-frontend enhancements to the PaisaPal expense tracker.

1. **Transaction Notes Quick-View** — an inline accordion on each transaction row (desktop table) and card (mobile) that expands to show the full notes text without opening the edit form. Only transactions with non-empty notes show the expand affordance.

2. **Month-over-Month Trend Sparkline** — a new dashboard widget that renders a small Recharts area/line chart of total spend for the last 6 calendar months, computed client-side from the full transactions store, with a trend indicator showing direction and percentage change between the oldest and newest month in the window.

3. **Yearly Dashboard View** — a mode toggle alongside the existing month picker that switches the dashboard to a yearly aggregate view. In yearly mode all existing widgets show data for the full selected year, the month-specific controls (day filter, category filter month picker) are hidden or adapted, and the user can navigate between years.

No API changes, schema changes, or new dependencies are required. Recharts is already installed. The store's full `transactions` array is available client-side.

---

## Glossary

- **TransactionsPage**: The page component at `src/pages/TransactionsPage.tsx` that lists all transactions.
- **Transaction**: The data type defined in `src/types/index.ts` representing a single expense entry, including an optional `notes` string field.
- **NotesAccordion**: The inline expandable section below a transaction row or card that shows the full notes text.
- **ExpandAffordance**: The chevron or notes icon that appears on a transaction row or card only when `notes` is non-empty, triggering the NotesAccordion.
- **Store**: The Zustand store at `src/store/index.ts` that holds the full `transactions` array.
- **DashboardPage**: The page component at `src/pages/DashboardPage.tsx` that renders all dashboard widgets.
- **DashboardFilters**: The component at `src/components/dashboard/DashboardFilters.tsx` that renders the month navigator, day-type switch, and category filter.
- **SparklineWidget**: The new dashboard component (`src/components/dashboard/MonthTrendSparkline.tsx`) that renders a 6-month spend sparkline.
- **SparklineDataPoint**: One data point in the sparkline: `{ month: string, total: number }` where `month` is `YYYY-MM` and `total` is the sum of all transaction amounts in that month.
- **TrendIndicator**: A visual element within the SparklineWidget showing an up or down arrow icon and the percentage change between the oldest and newest SparklineDataPoint.
- **ViewMode**: The dashboard toggle state — either `'monthly'` or `'yearly'`.
- **YearlyView**: The dashboard state when ViewMode is `'yearly'`, showing all widgets aggregated over the full selected year.
- **YearSelector**: The UI control in yearly mode that displays the selected year and allows the user to navigate to the previous or next year.
- **YearlyStats**: A `Stats`-shaped object computed from all transactions whose `dateKey` falls within the selected year (all 12 months).
- **SnapshotView**: A read-only mode (`isSnapshotView = true` in the Store) where data mutation actions are disabled.

---

## Requirements

### Requirement 1: Transaction Notes Quick-View — Expand Affordance

**User Story:** As a user, I want to see a visual cue on transaction rows that have notes, so that I know which transactions have additional context I can read.

#### Acceptance Criteria

1. WHEN a transaction has a non-empty `notes` field (after trimming whitespace), THE TransactionsPage SHALL render an ExpandAffordance icon on that transaction's desktop table row and mobile card.

2. WHEN a transaction has an empty or absent `notes` field, THE TransactionsPage SHALL NOT render an ExpandAffordance icon for that row or card.

3. THE ExpandAffordance SHALL be rendered as a chevron-down icon that rotates 180° when the NotesAccordion for that row is expanded.

4. THE ExpandAffordance SHALL be keyboard-accessible with an appropriate `aria-label` such as "Show notes" or "Hide notes".

---

### Requirement 2: Transaction Notes Quick-View — Inline Expansion

**User Story:** As a user, I want to expand a transaction row inline to read its full notes, so that I can see context without leaving the list or opening the edit form.

#### Acceptance Criteria

1. WHEN the user clicks or activates the ExpandAffordance on a transaction row, THE TransactionsPage SHALL toggle the NotesAccordion for that row between expanded and collapsed states.

2. WHEN the NotesAccordion for a row is expanded, THE TransactionsPage SHALL render the full `notes` text for that transaction below the row, with whitespace preserved.

3. WHEN the NotesAccordion is expanded, THE TransactionsPage SHALL NOT open the TransactionForm or any edit sheet.

4. WHEN a NotesAccordion is expanded and the user clicks the ExpandAffordance again, THE TransactionsPage SHALL collapse that NotesAccordion.

5. THE TransactionsPage SHALL support multiple NotesAccordions being expanded simultaneously.

6. WHEN a transaction row exits the DOM (e.g. due to filter changes or pagination), THE TransactionsPage SHALL treat its NotesAccordion as collapsed.

---

### Requirement 3: Transaction Notes Quick-View — Mobile Card Layout

**User Story:** As a user browsing on mobile, I want the same inline notes expansion available on transaction cards, so that I can read notes without switching to a different view.

#### Acceptance Criteria

1. WHEN a mobile transaction card has a non-empty `notes` field, THE TransactionsPage SHALL render an ExpandAffordance on that card.

2. WHEN the user taps the ExpandAffordance on a mobile card, THE TransactionsPage SHALL expand a NotesAccordion below the card's main content showing the full notes text.

3. THE mobile NotesAccordion SHALL animate open and closed using the same `framer-motion` `AnimatePresence` pattern already used elsewhere in the TransactionsPage.

---

### Requirement 4: Month-over-Month Trend Sparkline — Data Computation

**User Story:** As a user, I want to see a quick visual of my total spend over the last 6 months, so that I can spot whether my spending is trending up or down without doing manual calculations.

#### Acceptance Criteria

1. THE SparklineWidget SHALL compute SparklineDataPoints for the 6 most recent calendar months that contain at least one transaction, using the full `transactions` array from the Store.

2. THE SparklineWidget SHALL read transaction data directly from the Store and SHALL NOT use the `filteredTxs` or `filteredStats` values computed by the DashboardPage.

3. FOR ANY SparklineDataPoint, the `total` value SHALL equal the arithmetic sum of the `amount` field across all transactions whose `dateKey` (or `date` field, falling back if `dateKey` is absent) starts with that month's `YYYY-MM` prefix.

4. WHEN the Store's `transactions` array changes, THE SparklineWidget SHALL recompute SparklineDataPoints without requiring a page reload.

5. WHEN fewer than 2 months of transaction data exist in the Store, THE SparklineWidget SHALL render an empty-state message instead of a chart.

---

### Requirement 5: Month-over-Month Trend Sparkline — Chart Rendering

**User Story:** As a user, I want to see the sparkline rendered as a small area chart with month labels, so that I can read the trend at a glance.

#### Acceptance Criteria

1. THE SparklineWidget SHALL render a Recharts `AreaChart` (or `LineChart`) with one data point per SparklineDataPoint, ordered chronologically oldest-to-newest left-to-right.

2. THE SparklineWidget SHALL render an x-axis with short month-year labels (e.g. "Jan '25") for each data point.

3. THE SparklineWidget SHALL use `hsl(var(--primary))` as the line/area stroke color, consistent with the existing DailyTrend chart.

4. THE SparklineWidget SHALL render a tooltip showing the month name and formatted total spend when the user hovers over a data point.

5. THE SparklineWidget SHALL be rendered within the existing dashboard widget grid, consistent with the `card-base` card style used by other dashboard widgets.

---

### Requirement 6: Month-over-Month Trend Sparkline — Trend Indicator

**User Story:** As a user, I want to see an up or down arrow with a percentage change, so that I can understand the direction and magnitude of my spending trend at a glance.

#### Acceptance Criteria

1. THE SparklineWidget SHALL render a TrendIndicator showing the percentage change between the oldest and newest SparklineDataPoint in the 6-month window.

2. WHEN the newest month's total is greater than the oldest month's total, THE TrendIndicator SHALL display an upward arrow icon and the text "X% vs [oldest month label]".

3. WHEN the newest month's total is less than the oldest month's total, THE TrendIndicator SHALL display a downward arrow icon and the text "X% vs [oldest month label]".

4. WHEN the oldest month's total is zero, THE SparklineWidget SHALL not render a TrendIndicator percentage (to avoid division by zero), and SHALL instead render a neutral indicator.

5. FOR ANY two SparklineDataPoints with totals `oldest` and `newest` where `oldest > 0`, the TrendIndicator percentage SHALL equal `Math.round(Math.abs(newest - oldest) / oldest * 100)`.

---

### Requirement 7: Yearly Dashboard View — Mode Toggle

**User Story:** As a user, I want a toggle to switch between monthly and yearly views on the dashboard, so that I can see both granular monthly data and high-level annual summaries.

#### Acceptance Criteria

1. THE DashboardFilters SHALL render a ViewMode toggle with two options: "Month" and "Year", positioned alongside the existing month navigator.

2. WHEN the ViewMode toggle is set to `'monthly'`, THE DashboardPage SHALL display the existing monthly layout with the month navigator, day-type switch, and category filter unchanged.

3. WHEN the ViewMode toggle is set to `'yearly'`, THE DashboardPage SHALL hide the month navigator, day-type switch, and category filter, and SHALL display a YearSelector instead.

4. THE ViewMode toggle SHALL default to `'monthly'` on initial render.

5. WHEN the user switches from `'monthly'` to `'yearly'`, THE DashboardPage SHALL default the selected year to the current calendar year.

---

### Requirement 8: Yearly Dashboard View — Year Selector

**User Story:** As a user, I want to navigate between years on the yearly dashboard, so that I can compare spending across different years.

#### Acceptance Criteria

1. THE YearSelector SHALL display the currently selected year and provide "previous year" and "next year" navigation buttons, consistent with the existing month navigator chevron pattern.

2. THE YearSelector SHALL derive the list of available years from the full `transactions` array in the Store.

3. WHEN the selected year has no earlier year with transaction data, THE YearSelector SHALL disable the "previous year" button.

4. WHEN the selected year is the current calendar year, THE YearSelector SHALL disable the "next year" button.

5. WHEN the user clicks "previous year" or "next year", THE DashboardPage SHALL update YearlyStats to reflect transactions in the newly selected year.

---

### Requirement 9: Yearly Dashboard View — Yearly Aggregation

**User Story:** As a user, I want all dashboard widgets to show full-year data when in yearly mode, so that I can see my annual spending patterns in one place.

#### Acceptance Criteria

1. WHEN ViewMode is `'yearly'`, THE DashboardPage SHALL compute YearlyStats from all transactions whose `dateKey` (or `date`) year component equals the selected year.

2. WHEN ViewMode is `'yearly'`, THE DashboardPage SHALL pass YearlyStats to the `CategoryDonut`, `TopCategories`, `AvgTransactionByCategory`, `CategoryModeSplit`, `QuickStats`, `RecentTransactions`, `SpendingHeatmap`, `WeeklySpendingHeatmap`, `WeeklySpendSummary`, and `CumulativeSpend` widgets in place of the monthly `filteredStats`.

3. WHEN ViewMode is `'yearly'`, THE DashboardPage SHALL pass the year's transactions to the `DailyTrend` widget with monthly-bucketed data so each data point represents one calendar month's total spend (12 data points for a full year).

4. WHEN ViewMode is `'yearly'`, THE DashboardPage SHALL hide the `BudgetRing` widget, since the monthly budget does not apply to the full year.

5. WHEN ViewMode is `'yearly'`, THE DashboardPage SHALL hide the `MonthlyComparison` widget, since it is a month-level comparison tool.

6. FOR ANY selected year, YearlyStats total spend SHALL equal the arithmetic sum of the `amount` field across all transactions whose `dateKey` year component matches the selected year.

---

### Requirement 10: Yearly Dashboard View — Unchanged Monthly Behavior

**User Story:** As a user, I want the monthly view to remain fully functional when I switch back from yearly mode, so that no existing features are degraded.

#### Acceptance Criteria

1. WHEN the user switches ViewMode from `'yearly'` back to `'monthly'`, THE DashboardPage SHALL restore the previously selected month, day filter, and category filter to their prior values.

2. WHILE ViewMode is `'monthly'`, ALL existing monthly dashboard widgets SHALL behave identically to how they behaved before the yearly view feature was introduced.

3. WHEN the DashboardPage is first loaded, THE DashboardPage SHALL render in `'monthly'` mode with all monthly controls visible.
