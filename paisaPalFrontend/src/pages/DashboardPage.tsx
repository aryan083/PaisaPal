import { useState, useMemo, useEffect } from 'react'
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
import { getAvailableMonths, filterTransactions, computeFilteredStats } from '@/lib/dashboardUtils'
import { getAvailableCategories, type Category } from '@/types'

const container = { animate: { transition: { staggerChildren: 0.04 } } }
const item = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }

export function DashboardPage() {
  const { transactions, settings } = useStore()

  const categories = useMemo(
    () => getAvailableCategories(settings),
    [settings],
  )

  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions])
  const [selectedMonth, setSelectedMonth] = useState(
    () => availableMonths[0] || new Date().toISOString().slice(0, 7)
  )
  const [dayFilter, setDayFilter] = useState<DayFilter>('all')
  const [selectedCategories, setSelectedCategories] = useState<Category[]>(() => [...categories])

  useEffect(() => {
    setSelectedCategories(prev => {
      const allowed = new Set(categories)
      const next = prev.filter(c => allowed.has(c))
      return next.length > 0 ? next : [...categories]
    })
  }, [categories])

  const filteredTxs = useMemo(() => {
    const byMonthAndDay = filterTransactions(transactions, selectedMonth, dayFilter)
    const selected = new Set(selectedCategories)
    return byMonthAndDay.filter(t => selected.has(t.category))
  }, [transactions, selectedMonth, dayFilter, selectedCategories])

  const filteredStats = useMemo(() => computeFilteredStats(filteredTxs), [filteredTxs])
  const budget = settings.stipend + settings.extra
  const noData = !filteredStats

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
      />

      <BudgetRing stats={filteredStats} />

      {noData ? (
        <div className="mt-8 text-center py-12 text-muted-foreground card-base">
          No transactions found for this filter. Try changing the month or day type.
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
            <motion.div variants={item}><DailyTrend stats={filteredStats} /></motion.div>
            <motion.div variants={item}><CumulativeSpend stats={filteredStats} budget={budget} /></motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
            <motion.div variants={item}><CategoryDonut stats={filteredStats} /></motion.div>
            <motion.div variants={item}><AvgTransactionByCategory stats={filteredStats} /></motion.div>
            <motion.div variants={item}><CategoryModeSplit transactions={filteredTxs} /></motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            <motion.div variants={item}><TopCategories stats={filteredStats} /></motion.div>
            <div className="flex flex-col gap-3">
              <motion.div variants={item}>
                <WeeklySpendSummary transactions={filteredTxs} />
              </motion.div>
              <motion.div variants={item}><QuickStats stats={filteredStats} /></motion.div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            <motion.div variants={item}>
              <SpendingCalendar transactions={filteredTxs} selectedMonth={selectedMonth} />
            </motion.div>
            <motion.div variants={item}>
              <WeeklySpendingHeatmap transactions={filteredTxs} dayFilter={dayFilter} />
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            <motion.div variants={item}>
              <RecentTransactions transactions={filteredTxs} />
            </motion.div>
            <motion.div variants={item}>
              <SpendingHeatmap transactions={filteredTxs} dayFilter={dayFilter} />
            </motion.div>
          </div>

        </motion.div>
      )}
    </motion.div>
  )
}