# Implementation Plan: dashboard-enhancements

## Overview

Three sequential feature additions to the PaisaPal frontend: notes quick-view on transaction rows/cards, a 6-month spend sparkline widget, and a yearly dashboard view mode. Each builds on existing patterns (framer-motion, Recharts, Zustand, Tailwind card-base style).

## Tasks

- [ ] 1. Add notes quick-view to TransactionsPage (desktop + mobile)
  - [ ] 1.1 Add `expandedNoteIds` state and `toggleNote` callback to `TransactionsPage.tsx`
    - Add `useState<Set<string>>` for `expandedNoteIds` and a `useCallback` toggleNote helper
    - Import `ChevronDown` from lucide-react alongside existing icon imports
    - _Requirements: 1.1, 2.1_

  - [ ] 1.2 Update desktop table notes cell to show ExpandAffordance and expand row
    - Replace the static notes `<td>` with a chevron button (visible only when `notes.trim()` is non-empty)
    - Add an animated `<motion.tr>` expand row rendered after each data row when that id is in `expandedNoteIds`
    - Use `initial/animate/exit` height animation consistent with existing `AnimatePresence` usage
    - The expand row uses `colSpan={9}` and renders notes in a `bg-secondary/60` rounded block with `whitespace-pre-wrap`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 1.3 Write property test for notes affordance matches notes presence (Property 1)
    - **Property 1: Notes affordance matches notes presence**
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 1.4 Write property test for notes accordion toggle round-trip (Property 2)
    - **Property 2: Notes accordion toggle is a round trip**
    - **Validates: Requirements 2.1, 2.4**

  - [ ]* 1.5 Write property test for expanded accordion shows correct content (Property 3)
    - **Property 3: Expanded accordion shows correct notes content**
    - **Validates: Requirements 2.2**

  - [ ]* 1.6 Write property test for multiple accordions open simultaneously (Property 4)
    - **Property 4: Multiple accordions can be open simultaneously**
    - **Validates: Requirements 2.5**

  - [ ] 1.7 Update mobile card layout to show ExpandAffordance and animated notes panel
    - Add chevron+label button below existing card content when `notes.trim()` is non-empty
    - Wrap the expand panel in `<AnimatePresence>` with `motion.div` height animation
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 2. Add `computeYearlyTrend` to `dashboardUtils.ts`
  - [ ] 2.1 Implement `computeYearlyTrend(transactions, year)` in `dashboardUtils.ts`
    - Export `YearlyTrendPoint` interface `{ date: string; total: number }`
    - Pre-populate a `Map` with all 12 `YYYY-MM` keys initialized to 0 for the given year
    - Sum `t.amount` into the correct month bucket using `t.dateKey || toLocalDateKey(t.date)`
    - Return the 12 entries sorted chronologically as `YearlyTrendPoint[]`
    - _Requirements: 9.3, 9.6_

  - [ ]* 2.2 Write property test for yearly trend has exactly 12 data points (Property 10)
    - **Property 10: Yearly trend has exactly 12 data points**
    - **Validates: Requirements 9.3**

  - [ ]* 2.3 Write property test for yearly totals equal sum of matching transactions (Property 11)
    - **Property 11: Yearly totals equal sum of matching transactions**
    - **Validates: Requirements 9.1, 9.6**

- [ ] 3. Create `MonthTrendSparkline` component
  - [ ] 3.1 Create `src/components/dashboard/MonthTrendSparkline.tsx` with data computation
    - Export `SparklineDataPoint` interface `{ month: string; total: number; label: string }`
    - Use `useMemo` to call `getAvailableMonths` + `computeMonthMetrics` for the 6 most recent months, ordered oldest-to-newest
    - Compute `trendInfo` (direction, pct, oldestLabel) using the first and last data points; handle `oldest === 0` as neutral
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 3.2 Write property test for sparkline covers at most 6 months with transactions (Property 5)
    - **Property 5: Sparkline data covers at most 6 months, all with transactions**
    - **Validates: Requirements 4.1**

  - [ ]* 3.3 Write property test for sparkline totals equal sum of amounts per month (Property 6)
    - **Property 6: Sparkline totals equal sum of transaction amounts per month**
    - **Validates: Requirements 4.3**

  - [ ]* 3.4 Write property test for sparkline data is ordered chronologically (Property 7)
    - **Property 7: Sparkline data is ordered chronologically**
    - **Validates: Requirements 5.1**

  - [ ]* 3.5 Write property test for trend indicator direction (Property 8)
    - **Property 8: Trend indicator direction matches newest vs oldest total**
    - **Validates: Requirements 6.2, 6.3**

  - [ ]* 3.6 Write property test for trend indicator percentage formula (Property 9)
    - **Property 9: Trend indicator percentage formula**
    - **Validates: Requirements 6.1, 6.5**

  - [ ] 3.7 Implement chart and UI rendering in `MonthTrendSparkline.tsx`
    - Render a `ResponsiveContainer` > `AreaChart` with gradient fill matching `DailyTrend` pattern
    - Add `XAxis` (label), `YAxis` (₹ formatter), `Tooltip` (inline `SparklineTooltip` component), and `Area` using `hsl(var(--primary))`
    - Render TrendIndicator with `ArrowTrendingUp`/`ArrowTrendingDown` icons and "X% vs [label]" text (or "No baseline" when neutral)
    - Render empty-state message when `sparklineData.length < 2`
    - Wrap in `card-base` container consistent with other dashboard widgets
    - _Requirements: 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.4_

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Update `DashboardFilters` with viewMode toggle and YearSelector
  - [ ] 5.1 Extend `DashboardFilters` props interface and add ViewMode pill toggle
    - Add `viewMode`, `setViewMode`, `selectedYear`, `setSelectedYear`, `availableYears` to the `Props` interface
    - Add a `rounded-xl bg-secondary p-1` pill toggle rendering "Month" and "Year" buttons before the existing monthly controls
    - Wrap all existing monthly controls (`MonthNavigator`, `DayTypeSwitch`, `CategoryFilterDropdown`) in `{viewMode === 'monthly' && ...}` guard
    - Import `ChevronLeft`, `ChevronRight` (already present)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 5.2 Add `YearSelector` inline within `DashboardFilters` for yearly mode
    - Render a `{viewMode === 'yearly' && ...}` block containing prev/next chevron buttons and a centred year label
    - Disable prev button when `!availableYears.includes(selectedYear - 1)`; disable next when `selectedYear >= new Date().getFullYear()`
    - Match the same `rounded-xl bg-secondary px-1 py-1` container style as the month navigator
    - _Requirements: 8.1, 8.3, 8.4_

- [ ] 6. Wire yearly view logic into `DashboardPage`
  - [ ] 6.1 Add `viewMode`, `selectedYear`, and `availableYears` state to `DashboardPage`
    - Add `useState<'monthly' | 'yearly'>('monthly')` for viewMode
    - Add `useState<number>(() => new Date().getFullYear())` for selectedYear
    - Derive `availableYears` via `useMemo` extracting distinct year integers from all transactions' `dateKey`
    - _Requirements: 7.4, 7.5, 8.2_

  - [ ]* 6.2 Write property test for available years derived from transaction data (Property 13)
    - **Property 13: Available years are derived from transaction data**
    - **Validates: Requirements 8.2**

  - [ ] 6.3 Compute `yearlyTxs`, `yearlyStats`, and `yearlyTrendStats` in `DashboardPage`
    - Filter transactions to selected year when viewMode is `'yearly'`
    - Call `computeFilteredStats(yearlyTxs)` for yearlyStats
    - Build `yearlyTrendStats` by spreading `yearlyStats` and replacing `byDate` with `computeYearlyTrend(yearlyTxs, selectedYear)`
    - Derive `activeStats` and `activeTxs` that resolve to yearly or monthly depending on viewMode
    - Import `computeYearlyTrend` from `dashboardUtils`
    - _Requirements: 9.1, 9.2, 9.3, 9.6_

  - [ ] 6.4 Pass new props to `DashboardFilters` and update all widget bindings
    - Pass `viewMode`, `setViewMode`, `selectedYear`, `setSelectedYear`, `availableYears` to `DashboardFilters`
    - Replace all `filteredStats` / `filteredTxs` references in widget props with `activeStats` / `activeTxs`
    - Pass `viewMode === 'yearly' ? yearlyTrendStats : filteredStats` to `DailyTrend`
    - _Requirements: 9.2, 9.3, 10.1, 10.2_

  - [ ] 6.5 Apply conditional widget rendering for yearly mode
    - Wrap `<BudgetRing>` in `{viewMode === 'monthly' && ...}`
    - Wrap `<MonthlyComparison>` in `{viewMode === 'monthly' && ...}`
    - Wrap `<SpendingCalendar>` in `{viewMode === 'monthly' && ...}`
    - Add `{viewMode === 'monthly' && <motion.div variants={item}><MonthTrendSparkline /></motion.div>}` after ROW 1
    - _Requirements: 9.4, 9.5_

  - [ ]* 6.6 Write property test for year navigation preserves monthly state (Property 12)
    - **Property 12: Year navigation preserves monthly state**
    - **Validates: Requirements 10.1**

- [ ] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests should use `fast-check` with Vitest (consistent with the existing test setup)
- Each property test must run a minimum of 100 iterations
- The `MonthTrendSparkline` reads from the Zustand store directly — it does not accept props
- `computeYearlyTrend` always returns exactly 12 data points regardless of how many months have data
