import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '@/store'
import { BudgetRing } from '@/components/dashboard/BudgetRing'
import { CategoryDonut } from '@/components/dashboard/CategoryDonut'
import { DailyTrend } from '@/components/dashboard/DailyTrend'
import { TopCategories } from '@/components/dashboard/TopCategories'
import { QuickStats } from '@/components/dashboard/QuickStats'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { PaymentModeSplit } from '@/components/dashboard/PaymentModeSplit'
import { CategoryModeSplit } from '@/components/dashboard/CategoryModeSplit'
import { CumulativeSpend } from '@/components/dashboard/CumulativeSpend'
import { SpendingHeatmap } from '@/components/dashboard/SpendingHeatmap'
import { AvgTransactionByCategory } from '@/components/dashboard/AvgTransactionByCategory'
import { DashboardFilters, type DayFilter } from '@/components/dashboard/DashboardFilters'
import { getAvailableMonths, filterTransactions, computeFilteredStats } from '@/lib/dashboardUtils'

const container = { animate: { transition: { staggerChildren: 0.05 } } }
const item = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }

export function DashboardPage() {
  const { transactions, settings } = useStore()

  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions])
  const [selectedMonth, setSelectedMonth] = useState(() => availableMonths[0] || new Date().toISOString().slice(0, 7))
  const [dayFilter, setDayFilter] = useState<DayFilter>('all')

  const filteredTxs = useMemo(
    () => filterTransactions(transactions, selectedMonth, dayFilter),
    [transactions, selectedMonth, dayFilter]
  )

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
      />

      <BudgetRing />

      {noData ? (
        <div className="mt-8 text-center py-12 text-muted-foreground card-base">
          No transactions found for this filter. Try changing the month or day type.
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="initial"
          animate="animate"
          className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          <motion.div variants={item}><CategoryDonut stats={filteredStats} /></motion.div>
          <motion.div variants={item} className="md:col-span-2 lg:col-span-2"><DailyTrend stats={filteredStats} /></motion.div>
          <motion.div variants={item} className="md:col-span-2 lg:col-span-2"><CategoryModeSplit transactions={filteredTxs} /></motion.div>
          <motion.div variants={item}><TopCategories stats={filteredStats} /></motion.div>
          <motion.div variants={item} className="md:col-span-2 lg:col-span-2"><CumulativeSpend stats={filteredStats} budget={budget} /></motion.div>
          <motion.div variants={item}><SpendingHeatmap transactions={filteredTxs} /></motion.div>
          <motion.div variants={item}><AvgTransactionByCategory stats={filteredStats} /></motion.div>
          <motion.div variants={item}><QuickStats stats={filteredStats} /></motion.div>
          <motion.div variants={item}><RecentTransactions transactions={filteredTxs} /></motion.div>
          <motion.div variants={item}><PaymentModeSplit stats={filteredStats} /></motion.div>
        </motion.div>
      )}
    </motion.div>
  )
}
