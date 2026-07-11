import { useState, useMemo, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '@/store'

import { BudgetRing } from '@/components/dashboard/BudgetRing'
import { CategoryDonut } from '@/components/dashboard/CategoryDonut'
import { DailyTrend } from '@/components/dashboard/DailyTrend'
import { TopCategories } from '@/components/dashboard/TopCategories'
import { QuickStats } from '@/components/dashboard/QuickStats'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { CategoryModeSplit } from '@/components/dashboard/CategoryModeSplit'
import { CumulativeSpend } from '@/components/dashboard/CumulativeSpend'
import { SpendingHeatmap } from '@/components/dashboard/SpendingHeatmap'
import { AvgTransactionByCategory } from '@/components/dashboard/AvgTransactionByCategory'
import { WeeklySpendingHeatmap } from '@/components/dashboard/WeeklySpendingHeatmap'
import { SpendingCalendar } from '@/components/dashboard/SpendingCalendar'
import { WeeklySpendSummary } from '@/components/dashboard/WeeklySpendSummary'
import { DashboardFilters, type DayFilter } from '@/components/dashboard/DashboardFilters'
import { MonthlyComparison } from '@/components/dashboard/MonthlyComparison'
import { MonthTrendSparkline } from '@/components/dashboard/MonthTrendSparkline'
import {
  getAvailableMonths,
  filterTransactions,
  computeFilteredStats,
  computeYearlyTrend,
} from '@/lib/dashboardUtils'
import { getAvailableCategories, type Category } from '@/types'
import { toLocalDateKey } from '@/lib/utils'

const container = { animate: { transition: { staggerChildren: 0.04 } } }
const item = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }

export function DashboardPage() {
  const { transactions, settings } = useStore()

  const categories = useMemo(
    () => getAvailableCategories(settings),
    [settings],
  )

  // ── Monthly view state ──────────────────────────────────────────────────────
  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions])
  const [selectedMonth, setSelectedMonth] = useState(
    () => availableMonths[0] || new Date().toISOString().slice(0, 7)
  )
  const [dayFilter, setDayFilter] = useState<DayFilter>('all')
  const [selectedCategories, setSelectedCategories] = useState<Category[]>(() => [...categories])

  const prevCategoriesRef = useRef<Category[]>(categories)

  useEffect(() => {
    const prevCategories = prevCategoriesRef.current

    setSelectedCategories(prev => {
      const allowed = new Set(categories)
      const cleanedPrev = prev.filter(c => allowed.has(c))

      // If user previously had all categories selected, keep it as "all" even when
      // new categories are loaded (e.g. settings/custom categories on first load).
      const prevWasAllSelected =
        prevCategories.length > 0 &&
        cleanedPrev.length === prevCategories.length &&
        prevCategories.every(c => cleanedPrev.includes(c))

      if (prevWasAllSelected) return [...categories]
      return cleanedPrev.length > 0 ? cleanedPrev : [...categories]
    })

    prevCategoriesRef.current = categories
  }, [categories])

  const filteredTxs = useMemo(() => {
    const byMonthAndDay = filterTransactions(transactions, selectedMonth, dayFilter)
    const selected = new Set(selectedCategories)
    return byMonthAndDay.filter(t => selected.has(t.category))
  }, [transactions, selectedMonth, dayFilter, selectedCategories])

  const filteredStats = useMemo(() => computeFilteredStats(filteredTxs), [filteredTxs])

  // ── Yearly view state ───────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly')
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear())

  // Distinct years derived from all transactions (not just filtered)
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    transactions.forEach(t => {
      const dk = t.dateKey || toLocalDateKey(t.date)
      years.add(parseInt(dk.slice(0, 4)))
    })
    return Array.from(years).sort()
  }, [transactions])

  const yearlyTxs = useMemo(() => {
    if (viewMode !== 'yearly') return []
    return transactions.filter(t => {
      const dk = t.dateKey || toLocalDateKey(t.date)
      return parseInt(dk.slice(0, 4)) === selectedYear
    })
  }, [transactions, viewMode, selectedYear])

  const yearlyStats = useMemo(() => computeFilteredStats(yearlyTxs), [yearlyTxs])

  // yearlyTrendStats replaces byDate with monthly-bucketed data for DailyTrend
  const yearlyTrendStats = useMemo(() => {
    if (!yearlyStats) return null
    return {
      ...yearlyStats,
      byDate: computeYearlyTrend(yearlyTxs, selectedYear),
    }
  }, [yearlyStats, yearlyTxs, selectedYear])

  // ── Active stats/transactions (used by widgets) ─────────────────────────────
  const activeStats = viewMode === 'yearly' ? yearlyStats : filteredStats
  const activeTxs   = viewMode === 'yearly' ? yearlyTxs   : filteredTxs

  const budget = settings.stipend + settings.extra
  const noData = !activeStats

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <h1 className="text-display text-2xl font-bold text-foreground mb-4">Dashboard</h1>

      <DashboardFilters
        dayFilter={dayFilter}
        setDayFilter={setDayFilter}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        availableMonths={availableMonths}
        categories={categories}
        selectedCategories={selectedCategories}
        setSelectedCategories={setSelectedCategories}
        viewMode={viewMode}
        setViewMode={setViewMode}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        availableYears={availableYears}
      />

      {/* BudgetRing — hidden in yearly mode (monthly budget doesn't apply) */}
      {viewMode === 'monthly' && <BudgetRing stats={filteredStats} />}

      {noData ? (
        <div className="mt-8 text-center py-12 text-muted-foreground card-base">
          No transactions found for this filter. Try changing the {viewMode === 'yearly' ? 'year' : 'month or day type'}.
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="initial"
          animate="animate"
          className="mt-6 flex flex-col gap-3"
        >

          {/* ── ROW 1 ─────────────────────────────────────────────────────────
              DailyTrend + CumulativeSpend
              Both area charts, naturally same height. Simple equal 2-col.
          ──────────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <motion.div variants={item}>
              <DailyTrend stats={viewMode === 'yearly' ? yearlyTrendStats : filteredStats} />
            </motion.div>
            <motion.div variants={item}><CumulativeSpend stats={activeStats} budget={budget} /></motion.div>
          </div>

          {/* ── Sparkline (monthly mode only) ─────────────────────────────── */}
          {viewMode === 'monthly' && (
            <motion.div variants={item}><MonthTrendSparkline /></motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
            <motion.div variants={item}><CategoryDonut stats={activeStats} /></motion.div>
            <motion.div variants={item}><AvgTransactionByCategory stats={activeStats} /></motion.div>
            <motion.div variants={item}><CategoryModeSplit transactions={activeTxs} /></motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            <motion.div variants={item}><TopCategories stats={activeStats} /></motion.div>
            <div className="flex flex-col gap-3">
              <motion.div variants={item}>
                <WeeklySpendSummary transactions={activeTxs} />
              </motion.div>
              <motion.div variants={item}><QuickStats stats={activeStats} /></motion.div>
            </div>
          </div>

          {/* SpendingCalendar — only meaningful in monthly mode */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            {viewMode === 'monthly' && (
              <motion.div variants={item}>
                <SpendingCalendar transactions={activeTxs} selectedMonth={selectedMonth} />
              </motion.div>
            )}
            <motion.div variants={item}>
              <WeeklySpendingHeatmap transactions={activeTxs} dayFilter={dayFilter} />
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            <motion.div variants={item}>
              <RecentTransactions transactions={activeTxs} />
            </motion.div>
            <motion.div variants={item}>
              <SpendingHeatmap transactions={activeTxs} dayFilter={dayFilter} />
            </motion.div>
          </div>

        </motion.div>
      )}

      {/* MonthlyComparison — hidden in yearly mode */}
      {viewMode === 'monthly' && (
        <motion.div variants={item} className="mt-3">
          <MonthlyComparison />
        </motion.div>
      )}
    </motion.div>
  )
}