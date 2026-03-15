import { motion } from 'framer-motion'
import { useStore } from '@/store'
import { formatCurrency, formatDateWithWeekday, parseLocalDate, toLocalDateKey } from '@/lib/utils'
import { useSavingsStats } from '@/hooks/useSavingsStats'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from 'recharts'
import {
  Bike, TrendingUp, Calendar, CreditCard, Trophy, Lightbulb,
  Activity, ShoppingBag, Flame, BarChart3, Star, Clock,
  ArrowUpDown, Percent, Target, Zap, AlertTriangle, Car,
  Wallet, Heart, Timer, Repeat, CircleDollarSign, Users, PiggyBank, RefreshCw,
  Award, Gauge, Shield, TrendingDown, PieChart as PieChartIcon
} from 'lucide-react'

interface InsightCardProps {
  icon: React.ElementType
  title: string
  color: string
  children: React.ReactNode
}

function InsightCard({ icon: Icon, title, color, children }: InsightCardProps) {
  return (
    <div className="card-base p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="rounded-lg p-1.5" style={{ background: `${color}18` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        <h3 className="text-display text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="text-sm">{children}</div>
    </div>
  )
}

const container = { animate: { transition: { staggerChildren: 0.05 } } }
const item = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }

export function InsightsPage() {
  const { stats, settings, transactions, envelopes } = useStore()
  const { stats: savingsStats } = useSavingsStats()

  if (!stats || transactions.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-display text-2xl font-bold text-foreground mb-6">Insights</h1>
        <div className="card-base p-12 text-center text-muted-foreground">No data yet. Add some transactions to see insights.</div>
      </motion.div>
    )
  }

  const budget = settings.stipend + settings.extra
  const pctUsed = budget > 0 ? Math.round((stats.totalSpent / budget) * 100) : 0
  const daysInMonth = 30
  const daysLeft = Math.max(0, daysInMonth - stats.activeDays)
  const dailyBurn = stats.dailyAverage
  const projectedTotal = stats.totalSpent + dailyBurn * daysLeft
  const targetDaily = daysLeft > 0 ? Math.round((budget - stats.totalSpent) / daysLeft) : 0

  const remaining = budget - stats.totalSpent

  const envelopeSummary = (() => {
    if (!envelopes) return { under: 0, warning: 0, over: 0 }
    const under = envelopes.envelopes.filter((e) => e.status === 'under').length
    const warning = envelopes.envelopes.filter((e) => e.status === 'warning').length
    const over = envelopes.envelopes.filter((e) => e.status === 'over').length
    return { under, warning, over }
  })()

  const onlinePct = stats.byMode.Online + stats.byMode.Cash > 0
    ? Math.round((stats.byMode.Online / (stats.byMode.Online + stats.byMode.Cash)) * 100) : 0

  const dates = transactions.map(t => t.dateKey || toLocalDateKey(t.date)).sort()
  const uniqueDates = [...new Set(dates)]
  let streak = 1
  for (let i = uniqueDates.length - 1; i > 0; i--) {
    const diff =
      (parseLocalDate(uniqueDates[i]).getTime() -
        parseLocalDate(uniqueDates[i - 1]).getTime()) /
      86400000
    if (diff === 1) streak++
    else break
  }

  const avgTx = Math.round(stats.totalSpent / stats.transactionCount)
  const mostFrequent = [...stats.byCategory].sort((a, b) => b.count - a.count)[0]

  let weekdaySpend = 0, weekendSpend = 0, weekdayCount = 0, weekendCount = 0
  transactions.forEach(t => {
    const day = parseLocalDate(t.dateKey || t.date).getDay()
    if (day === 0 || day === 6) { weekendSpend += t.amount; weekendCount++ }
    else { weekdaySpend += t.amount; weekdayCount++ }
  })

  const allDays = new Set<string>()
  if (uniqueDates.length > 0) {
    const start = parseLocalDate(uniqueDates[0])
    const end = parseLocalDate(uniqueDates[uniqueDates.length - 1])
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      allDays.add(toLocalDateKey(d))
    }
  }
  const zeroSpendDays = allDays.size - uniqueDates.length
  const smallest = transactions.reduce((min, t) => t.amount > 0 && (!min || t.amount < min.amount) ? t : min, transactions[0])
  const topCatPct = stats.byCategory.length > 0 ? Math.round((stats.byCategory[0].total / stats.totalSpent) * 100) : 0

  const sortedAmounts = [...transactions].map(t => t.amount).sort((a, b) => a - b)
  const median = sortedAmounts.length % 2 === 0
    ? Math.round((sortedAmounts[sortedAmounts.length / 2 - 1] + sortedAmounts[sortedAmounts.length / 2]) / 2)
    : sortedAmounts[Math.floor(sortedAmounts.length / 2)]

  const catShares = stats.byCategory.map(c => c.total / stats.totalSpent)
  const entropy = -catShares.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0)
  const maxEntropy = Math.log2(stats.byCategory.length || 1)
  const diversityPct = maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0

  const highValueTxns = transactions.filter(t => t.amount >= avgTx * 2)

  // === NEW INSIGHTS CALCULATIONS ===
  
  // 1. Category Creep - week over week growth
  const now = new Date()
  const thisWeekStart = new Date(now)
  thisWeekStart.setDate(now.getDate() - now.getDay())
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(thisWeekStart.getDate() - 7)
  
  const thisWeekTxns = transactions.filter(t => new Date(t.date) >= thisWeekStart)
  const lastWeekTxns = transactions.filter(t => {
    const d = new Date(t.date)
    return d >= lastWeekStart && d < thisWeekStart
  })
  
  const categoryCreep: { category: string; pctChange: number; thisWeek: number; lastWeek: number }[] = []
  const categories = [...new Set(transactions.map(t => t.category))]
  categories.forEach(cat => {
    const thisWeekTotal = thisWeekTxns.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0)
    const lastWeekTotal = lastWeekTxns.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0)
    if (lastWeekTotal > 0 && thisWeekTotal > lastWeekTotal) {
      categoryCreep.push({
        category: cat,
        pctChange: Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100),
        thisWeek: thisWeekTotal,
        lastWeek: lastWeekTotal
      })
    }
  })
  categoryCreep.sort((a, b) => b.pctChange - a.pctChange)
  
  // 2. Commute Cost Index
  const commuteTotal = stats.byCategory
    .filter(c => c.category === 'Rapido' || c.category === 'Bus/GSRTC')
    .reduce((s, c) => s + c.total, 0)
  const commutePctOfStipend = budget > 0 ? Math.round((commuteTotal / budget) * 100) : 0
  
  // 3. Cashflow by Week
  const weekSpending = [0, 0, 0, 0, 0]
  transactions.forEach(t => {
    const date = new Date(t.date)
    const dayOfMonth = date.getDate()
    const weekNum = Math.min(4, Math.floor((dayOfMonth - 1) / 7))
    weekSpending[weekNum] += t.amount
  })
  const weekLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5+']
  const week1Pct = stats.totalSpent > 0 ? Math.round((weekSpending[0] / stats.totalSpent) * 100) : 0
  
  // 4. Treat vs Need Ratio
  const needCategories = ['Rapido', 'Bus/GSRTC', 'Recharge/Bills']
  const treatCategories = ['Shopping', 'Social', 'Food & Drinks', 'Self Care']
  const needTotal = stats.byCategory
    .filter(c => needCategories.includes(c.category))
    .reduce((s, c) => s + c.total, 0)
  const treatTotal = stats.byCategory
    .filter(c => treatCategories.includes(c.category))
    .reduce((s, c) => s + c.total, 0)
  const treatPct = stats.totalSpent > 0 ? Math.round((treatTotal / stats.totalSpent) * 100) : 0
  
  // 5. Days Until Broke
  const daysUntilBroke = dailyBurn > 0 ? Math.floor((budget - stats.totalSpent) / dailyBurn) : 0
  
  // 6. Biggest Spending Gap (longest no-spend streak)
  let maxGap = 0
  let gapStart = ''
  let gapEnd = ''
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1])
    const curr = new Date(uniqueDates[i])
    const gap = Math.round((curr.getTime() - prev.getTime()) / 86400000) - 1
    if (gap > maxGap) {
      maxGap = gap
      gapStart = uniqueDates[i - 1]
      gapEnd = uniqueDates[i]
    }
  }
  
  // 7. Subscription/Recurring Detector
  const potentialRecurring: { particulars: string; amount: number; count: number }[] = []
  const groupedByParticulars: Record<string, { amount: number; count: number }> = {}
  transactions.forEach(t => {
    const key = t.particulars.toLowerCase().trim()
    if (!groupedByParticulars[key]) {
      groupedByParticulars[key] = { amount: t.amount, count: 0 }
    }
    groupedByParticulars[key].count++
  })
  Object.entries(groupedByParticulars).forEach(([key, val]) => {
    if (val.count >= 1 && val.amount > 0) {
      potentialRecurring.push({ particulars: key, amount: val.amount, count: val.count })
    }
  })
  potentialRecurring.sort((a, b) => b.count - a.count)
  
  // 8. Round Number Radar
  const roundNumbers = transactions.filter(t => t.amount % 100 === 0 && t.amount >= 100)
  const roundTotal = roundNumbers.reduce((s, t) => s + t.amount, 0)
  
  // 9. Social Spending Rate
  const socialTotal = stats.byCategory.find(c => c.category === 'Social')?.total || 0
  const socialPct = stats.totalSpent > 0 ? Math.round((socialTotal / stats.totalSpent) * 100) : 0
  const socialVsAvg = socialPct - 8 // national avg ~8%
  
  // 10. Best Value Day
  const dayStats: { date: string; count: number; total: number }[] = []
  uniqueDates.forEach(date => {
    const dayTxns = transactions.filter(t => (t.dateKey || toLocalDateKey(t.date)) === date)
    dayStats.push({
      date,
      count: dayTxns.length,
      total: dayTxns.reduce((s, t) => s + t.amount, 0)
    })
  })
  const bestValueDay = dayStats
    .filter(d => d.count >= 2)
    .sort((a, b) => a.total - b.total)[0]
  
  // 11. Monthly Projection Confidence
  const dailySpends = uniqueDates.map(d => 
    transactions.filter(t => (t.dateKey || toLocalDateKey(t.date)) === d).reduce((s, t) => s + t.amount, 0)
  )
  const avgDailySpend = dailySpends.length > 0 ? dailySpends.reduce((s, d) => s + d, 0) / dailySpends.length : 0
  const variance = dailySpends.length > 1 
    ? dailySpends.reduce((s, d) => s + Math.pow(d - avgDailySpend, 2), 0) / (dailySpends.length - 1) 
    : 0
  const stdDev = Math.sqrt(variance)
  const projectedLow = Math.round(stats.totalSpent + (avgDailySpend - stdDev * 0.5) * daysLeft)
  const projectedHigh = Math.round(stats.totalSpent + (avgDailySpend + stdDev * 0.5) * daysLeft)
  
  // 12. Stipend Survival Score
  const daysElapsed = stats.activeDays
  const pctOfMonthElapsed = daysInMonth > 0 ? daysElapsed / daysInMonth : 0
  const pctBudgetUsed = budget > 0 ? stats.totalSpent / budget : 0
  const pacingScore = pctOfMonthElapsed > 0 ? Math.max(0, 100 - Math.abs(pctBudgetUsed - pctOfMonthElapsed) * 200) : 100
  const diversityScore = diversityPct

  const survivalScore = Math.max(
    0,
    Math.min(10, Math.round(((pacingScore * 0.7 + diversityScore * 0.3) / 100) * 10)),
  )

return (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2, ease: 'easeOut' }}
  >
    <h1 className="text-display text-2xl font-bold text-foreground mb-6">Insights</h1>

    <motion.div
      variants={container}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
    >
      <InsightCard icon={PiggyBank} title="Savings Rate" color="#22d47a">
        <div className="text-display text-xl font-bold text-foreground">
          {savingsStats?.savingsRate ?? 0}%
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Total saved: {formatCurrency(savingsStats?.totalSaved ?? 0)}
        </div>
      </InsightCard>
        <motion.div variants={item}>
          <InsightCard icon={Bike} title="Rapido Deep Dive" color="#ff6b35">
            <p className="text-muted-foreground">Total: <span className="text-foreground font-semibold">{formatCurrency(stats.rapidoStats.total)}</span></p>
            <p className="text-muted-foreground">{stats.rapidoStats.count} rides · Avg {formatCurrency(stats.rapidoStats.avgPerRide)}/ride</p>
            {stats.rapidoStats.count > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">💡 2 fewer rides/week could save ~{formatCurrency(stats.rapidoStats.avgPerRide * 8)}/month</p>
            )}
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={TrendingUp} title="Budget Health" color="#22d47a">
            <p className="text-muted-foreground">
              {pctUsed}% used ·{' '}
              {remaining < 0
                ? `${formatCurrency(Math.abs(remaining))} over`
                : `${formatCurrency(remaining)} remaining`}
            </p>
            <p className="text-muted-foreground">Daily burn: {formatCurrency(dailyBurn)}</p>
            <p className="text-muted-foreground">Projected: {formatCurrency(projectedTotal)} {projectedTotal > budget ? '⚠️ Over budget!' : '✅ On track'}</p>
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Calendar} title="Peak Spend Day" color="#ff4f6a">
            {stats.biggestDay.date ? (
              <>
                <p className="text-foreground font-semibold">{formatDateWithWeekday(stats.biggestDay.date)}</p>
                <p className="text-muted-foreground">Total: {formatCurrency(stats.biggestDay.total)}</p>
              </>
            ) : <p className="text-muted-foreground">No data</p>}
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={CreditCard} title="Payment Habits" color="#4da6ff">
            <p className="text-muted-foreground">Online: {onlinePct}% · Cash: {100 - onlinePct}%</p>
            <p className="text-muted-foreground">Online: {formatCurrency(stats.byMode.Online)} · Cash: {formatCurrency(stats.byMode.Cash)}</p>
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Trophy} title="Top Category" color="#ffaa2b">
            {stats.byCategory[0] && (
              <>
                <p className="text-foreground font-semibold">{stats.byCategory[0].category}</p>
                <p className="text-muted-foreground">{formatCurrency(stats.byCategory[0].total)} · {topCatPct}% of total</p>
              </>
            )}
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Lightbulb} title="Smart Savings Tip" color="#22d47a">
            <p className="text-muted-foreground">Target daily: {formatCurrency(targetDaily)} to stay within budget</p>
            <p className="text-xs text-muted-foreground mt-1">
              {dailyBurn > targetDaily
                ? `⚠️ Spending ${formatCurrency(dailyBurn - targetDaily)} above target daily`
                : `✅ ${formatCurrency(targetDaily - dailyBurn)} below target daily`}
            </p>
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Activity} title="Spending Velocity" color="#ff6b35">
            <p className="text-muted-foreground">Actual avg: {formatCurrency(dailyBurn)}/day</p>
            <p className="text-muted-foreground">Budget pace: {formatCurrency(Math.round(budget / daysInMonth))}/day</p>
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={ShoppingBag} title="Biggest Purchase" color="#b06aff">
            {stats.biggestTransaction ? (
              <>
                <p className="text-foreground font-semibold">{stats.biggestTransaction.particulars}</p>
                <p className="text-muted-foreground">{formatCurrency(stats.biggestTransaction.amount)} · {formatDateWithWeekday(stats.biggestTransaction.date)}</p>
              </>
            ) : <p className="text-muted-foreground">No data</p>}
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Flame} title="Spending Streak" color="#ff4f6a">
            <p className="text-foreground font-semibold">{streak} consecutive day{streak !== 1 ? 's' : ''}</p>
            <p className="text-muted-foreground">{zeroSpendDays} zero-spend day{zeroSpendDays !== 1 ? 's' : ''} 🎉</p>
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={BarChart3} title="Average Transaction" color="#4da6ff">
            <p className="text-foreground font-semibold">{formatCurrency(avgTx)}</p>
            <p className="text-muted-foreground">Median: {formatCurrency(median)} across {stats.transactionCount} transactions</p>
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Star} title="Most Frequent Category" color="#ffaa2b">
            {mostFrequent && (
              <>
                <p className="text-foreground font-semibold">{mostFrequent.category}</p>
                <p className="text-muted-foreground">{mostFrequent.count} transactions · {formatCurrency(mostFrequent.total)}</p>
              </>
            )}
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Clock} title="Weekday vs Weekend" color="#ff80c8">
            <p className="text-muted-foreground">Weekday: {formatCurrency(weekdaySpend)} ({weekdayCount} txns)</p>
            <p className="text-muted-foreground">Weekend: {formatCurrency(weekendSpend)} ({weekendCount} txns)</p>
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Percent} title="Spending Diversity" color="#00d4a4">
            <p className="text-foreground font-semibold">{diversityPct}% diverse</p>
            <p className="text-muted-foreground">
              {diversityPct > 70 ? 'Well-distributed spending' : diversityPct > 40 ? 'Moderately concentrated' : 'Highly concentrated'}
            </p>
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={ArrowUpDown} title="Smallest Purchase" color="#6080a0">
            {smallest && (
              <>
                <p className="text-foreground font-semibold">{smallest.particulars}</p>
                <p className="text-muted-foreground">{formatCurrency(smallest.amount)} · {formatDateWithWeekday(smallest.date)}</p>
              </>
            )}
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Zap} title="High-Value Transactions" color="#ff6080">
            <p className="text-foreground font-semibold">{highValueTxns.length} above average</p>
            <p className="text-muted-foreground">
              ≥{formatCurrency(avgTx * 2)} totaling {formatCurrency(highValueTxns.reduce((s, t) => s + t.amount, 0))}
            </p>
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Target} title="Category Breakdown" color="#b06aff">
            <div className="flex flex-col gap-1">
              {stats.byCategory.slice(0, 4).map(c => (
                <div key={c.category} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{c.category}</span>
                  <span className="text-foreground font-medium">{Math.round((c.total / stats.totalSpent) * 100)}%</span>
                </div>
              ))}
            </div>
          </InsightCard>
        </motion.div>

        {/* === NEW INSIGHTS === */}

        <motion.div variants={item}>
          <InsightCard icon={TrendingUp} title="Category Creep" color="#ff6b35">
            {categoryCreep.length > 0 ? (
              <>
                <p className="text-foreground font-semibold">{categoryCreep[0].category} up {categoryCreep[0].pctChange}%</p>
                <p className="text-muted-foreground">vs last week: {formatCurrency(categoryCreep[0].lastWeek)} → {formatCurrency(categoryCreep[0].thisWeek)}</p>
                <p className="text-xs text-muted-foreground mt-1">⚠️ Watch for budget leaks</p>
              </>
            ) : (
              <p className="text-muted-foreground">No category growth this week ✅</p>
            )}
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Car} title="Commute Cost Index" color="#4da6ff">
            <p className="text-foreground font-semibold">{formatCurrency(commuteTotal)}/month</p>
            <p className="text-muted-foreground">{commutePctOfStipend}% of your stipend</p>
            <p className="text-xs text-muted-foreground mt-1">Rapido + Bus combined</p>
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={BarChart3} title="Cashflow by Week" color="#22d47a">
            <div className="flex flex-col gap-1">
              {weekSpending.slice(0, 4).map((w, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{weekLabels[i]}</span>
                  <span className="text-foreground font-medium">{formatCurrency(w)}</span>
                </div>
              ))}
            </div>
            {week1Pct > 40 && (
              <p className="text-xs text-[hsl(var(--danger))] mt-2">⚠️ Week 1 is {week1Pct}% of spending</p>
            )}
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Heart} title="Treat vs Need" color="#ff80c8">
            <p className="text-muted-foreground">Needs: <span className="text-foreground font-semibold">{formatCurrency(needTotal)}</span></p>
            <p className="text-muted-foreground">Treats: <span className="text-foreground font-semibold">{formatCurrency(treatTotal)}</span></p>
            <p className="text-xs text-muted-foreground mt-1">{treatPct}% discretionary spending</p>
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Timer} title="Days Until Broke" color="#ff4f6a">
            <p className="text-foreground font-semibold">{daysUntilBroke} days</p>
            <p className="text-muted-foreground">at {formatCurrency(dailyBurn)}/day burn rate</p>
            {daysUntilBroke < 10 && (
              <p className="text-xs text-[hsl(var(--danger))] mt-1">⚠️ Slow down spending!</p>
            )}
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={TrendingDown} title="No-Spend Streak" color="#00d4a4">
            {maxGap > 0 ? (
              <>
                <p className="text-foreground font-semibold">{maxGap} day{maxGap !== 1 ? 's' : ''}</p>
                <p className="text-muted-foreground">{formatDateWithWeekday(gapStart)} → {formatDateWithWeekday(gapEnd)}</p>
              </>
            ) : (
              <p className="text-muted-foreground">No gaps yet — you're spending daily</p>
            )}
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Repeat} title="Recurring Detector" color="#b06aff">
            {potentialRecurring.length > 0 ? (
              <>
                <p className="text-foreground font-semibold">{potentialRecurring[0].particulars.slice(0, 20)}</p>
                <p className="text-muted-foreground">{formatCurrency(potentialRecurring[0].amount)} × {potentialRecurring[0].count} time{potentialRecurring[0].count !== 1 ? 's' : ''}</p>
                <p className="text-xs text-muted-foreground mt-1">💡 Possible recurring cost</p>
              </>
            ) : (
              <p className="text-muted-foreground">No patterns detected</p>
            )}
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={CircleDollarSign} title="Round Number Radar" color="#ffaa2b">
            <p className="text-foreground font-semibold">{roundNumbers.length} transactions</p>
            <p className="text-muted-foreground">{formatCurrency(roundTotal)} total in round numbers</p>
            {roundNumbers.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">💡 Verify these are accurate</p>
            )}
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Users} title="Social Spending Rate" color="#ff6080">
            <p className="text-foreground font-semibold">{socialPct}% of total</p>
            <p className="text-muted-foreground">{formatCurrency(socialTotal)} on social events</p>
            <p className="text-xs text-muted-foreground mt-1">
              {socialVsAvg > 0 ? `${socialVsAvg}% above avg (8%)` : `${Math.abs(socialVsAvg)}% below avg (8%)`}
            </p>
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Award} title="Best Value Day" color="#22d47a">
            {bestValueDay ? (
              <>
                <p className="text-foreground font-semibold">{formatDateWithWeekday(bestValueDay.date)}</p>
                <p className="text-muted-foreground">{bestValueDay.count} txns · {formatCurrency(bestValueDay.total)} total</p>
                <p className="text-xs text-muted-foreground mt-1">🏆 Most efficient day</p>
              </>
            ) : (
              <p className="text-muted-foreground">Need more data</p>
            )}
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Gauge} title="Projection Confidence" color="#4da6ff">
            <p className="text-muted-foreground">Month-end range:</p>
            <p className="text-foreground font-semibold">{formatCurrency(projectedLow)} – {formatCurrency(projectedHigh)}</p>
            <p className="text-xs text-muted-foreground mt-1">Based on spending variance</p>
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Shield} title="Stipend Survival Score" color="#ffaa2b">
            <p className="text-foreground font-semibold">{survivalScore}/10</p>
            <p className="text-muted-foreground">
              {survivalScore >= 8 ? 'Excellent discipline!' : survivalScore >= 6 ? 'Good discipline' : survivalScore >= 4 ? 'Needs attention' : 'Critical - act now!'}
            </p>
            {categoryCreep.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Watch: {categoryCreep[0].category}</p>
            )}
          </InsightCard>
        </motion.div>
      </motion.div>

      {/* Budget & Envelope Charts Section */}
      <h2 className="text-display text-xl font-bold text-foreground mb-4 mt-8 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        Budget Analytics
      </h2>

      <motion.div
        variants={container}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"
      >
        {/* Budget vs Spent Bar Chart */}
        <motion.div variants={item} className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-display text-sm font-semibold text-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Budget vs Spent by Category
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={envelopes?.envelopes.map(e => ({
                category: e.category.slice(0, 12),
                limit: e.limit,
                spent: e.spent,
                remaining: Math.max(0, e.limit - e.spent)
              })) || []} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="limit" fill="#22d47a" name="Budget" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" fill="#ff6b35" name="Spent" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Category Spending Distribution */}
        <motion.div variants={item} className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-display text-sm font-semibold text-foreground flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-primary" />
              Spending Distribution
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.byCategory.slice(0, 6).map(c => ({
                    name: c.category,
                    value: c.total
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {stats.byCategory.slice(0, 6).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#22d47a', '#ff6b35', '#4da6ff', '#b06aff', '#ffaa2b', '#ff4f6a'][index % 6]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Envelope Utilization Gauge */}
        <motion.div variants={item} className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-display text-sm font-semibold text-foreground flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" />
              Envelope Health
            </h3>
          </div>
          <div className="space-y-3">
            {envelopes?.envelopes.slice(0, 5).map((env) => {
              const pct = env.limit > 0 ? Math.round((env.spent / env.limit) * 100) : 0
              const color = pct > 100 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22d47a'
              return (
                <div key={env.category} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{env.category}</span>
                    <span className="text-foreground font-medium">{pct}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(pct, 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>₹{env.spent}</span>
                    <span>₹{env.limit}</span>
                  </div>
                </div>
              )
            })}
            {!envelopes && (
              <p className="text-muted-foreground text-center py-8">No envelope data available</p>
            )}
          </div>
        </motion.div>

        {/* Spending Trend Over Time */}
        <motion.div variants={item} className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-display text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Daily Spending Trend
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={(() => {
                const dailyMap = new Map<string, number>()
                transactions.forEach(t => {
                  const date = t.dateKey || toLocalDateKey(t.date)
                  dailyMap.set(date, (dailyMap.get(date) || 0) + t.amount)
                })
                return Array.from(dailyMap.entries())
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .slice(-14)
                  .map(([date, amount]) => ({
                    date: date.slice(5),
                    amount
                  }))
              })()} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d47a" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22d47a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Area type="monotone" dataKey="amount" stroke="#22d47a" fillOpacity={1} fill="url(#colorAmount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </motion.div>

      {/* Budget Insights Grid */}
      <h2 className="text-display text-xl font-bold text-foreground mb-4 mt-8 flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-primary" />
        Budget Insights
      </h2>

      <motion.div
        variants={container}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      >
        {/* Budget Utilization % */}
        <motion.div variants={item}>
          <InsightCard icon={Percent} title="Budget Utilization" color="#4da6ff">
            <div className="text-display text-xl font-bold text-foreground">
              {envelopes ? Math.round((envelopes.envelopes.reduce((s, e) => s + e.spent, 0) / 
                Math.max(1, envelopes.envelopes.reduce((s, e) => s + e.limit, 0))) * 100) : 0}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {envelopes && (
                <>
                  ₹{envelopes.envelopes.reduce((s, e) => s + e.spent, 0)} of ₹
                  {envelopes.envelopes.reduce((s, e) => s + e.limit, 0)} allocated
                </>
              )}
            </div>
          </InsightCard>
        </motion.div>

        {/* Overspent Categories */}
        <motion.div variants={item}>
          <InsightCard icon={AlertTriangle} title="Over Budget" color="#ef4444">
            <div className="text-display text-xl font-bold text-foreground">
              {envelopes?.envelopes.filter(e => e.status === 'over').length || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              categories exceeded limit
            </div>
            {envelopes?.envelopes.filter(e => e.status === 'over').length ? (
              <p className="text-xs text-danger mt-2">
                {envelopes.envelopes.filter(e => e.status === 'over').map(e => e.category).slice(0, 2).join(', ')}
                {envelopes.envelopes.filter(e => e.status === 'over').length > 2 && '...'}
              </p>
            ) : (
              <p className="text-xs text-success mt-2">All categories on track!</p>
            )}
          </InsightCard>
        </motion.div>

        {/* Warning Categories */}
        <motion.div variants={item}>
          <InsightCard icon={Target} title="Near Limit" color="#f59e0b">
            <div className="text-display text-xl font-bold text-foreground">
              {envelopes?.envelopes.filter(e => e.status === 'warning').length || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              categories at 80%+ of limit
            </div>
            {envelopes?.envelopes.filter(e => e.status === 'warning').length ? (
              <p className="text-xs text-warning mt-2">
                Watch: {envelopes.envelopes.filter(e => e.status === 'warning').map(e => e.category).slice(0, 2).join(', ')}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">No warnings</p>
            )}
          </InsightCard>
        </motion.div>

        {/* Projected Month-End */}
        <motion.div variants={item}>
          <InsightCard icon={TrendingUp} title="Projected Spend" color="#22d47a">
            {(() => {
              if (!envelopes) return <div className="text-muted-foreground">No data</div>
              const totalSpent = envelopes.envelopes.reduce((s, e) => s + e.spent, 0)
              const totalBudget = envelopes.envelopes.reduce((s, e) => s + e.limit, 0)
              const daysElapsed = Math.max(1, new Date().getDate())
              const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
              const projected = Math.round((totalSpent / daysElapsed) * daysInMonth)
              const variance = projected - totalBudget
              return (
                <>
                  <div className="text-display text-xl font-bold text-foreground">
                    ₹{projected.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    vs ₹{totalBudget.toLocaleString()} budget
                  </div>
                  {variance > 0 ? (
                    <p className="text-xs text-danger mt-2">⚠️ ₹{variance.toLocaleString()} over</p>
                  ) : (
                    <p className="text-xs text-success mt-2">✅ ₹{Math.abs(variance).toLocaleString()} under</p>
                  )}
                </>
              )
            })()}
          </InsightCard>
        </motion.div>

        {/* Top Overspending */}
        <motion.div variants={item}>
          <InsightCard icon={TrendingDown} title="Highest Overspend" color="#ef4444">
            {(() => {
              if (!envelopes) return <div className="text-muted-foreground">No data</div>
              const overspent = envelopes.envelopes
                .filter(e => e.spent > e.limit)
                .sort((a, b) => (b.spent - b.limit) - (a.spent - a.limit))[0]
              if (!overspent) return (
                <>
                  <div className="text-foreground font-semibold">None</div>
                  <div className="text-xs text-muted-foreground mt-1">All within budget 🎉</div>
                </>
              )
              const overBy = overspent.spent - overspent.limit
              const pctOver = Math.round((overBy / overspent.limit) * 100)
              return (
                <>
                  <div className="text-foreground font-semibold">{overspent.category}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ₹{overBy.toLocaleString()} over ({pctOver}%)
                  </div>
                  <div className="text-xs text-danger mt-2">
                    ₹{overspent.spent.toLocaleString()} / ₹{overspent.limit.toLocaleString()}
                  </div>
                </>
              )
            })()}
          </InsightCard>
        </motion.div>

        {/* Savings Opportunity */}
        <motion.div variants={item}>
          <InsightCard icon={PiggyBank} title="Savings Opportunity" color="#22d47a">
            {(() => {
              if (!envelopes) return <div className="text-muted-foreground">No data</div>
              const underBudget = envelopes.envelopes.filter(e => e.spent < e.limit * 0.5)
              const potentialSavings = underBudget.reduce((s, e) => 
                s + Math.round(e.limit * 0.5 - e.spent), 0)
              return (
                <>
                  <div className="text-display text-xl font-bold text-foreground">
                    ₹{potentialSavings.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    available from underutilized categories
                  </div>
                  <div className="text-xs text-success mt-2">
                    {underBudget.length} categories below 50%
                  </div>
                </>
              )
            })()}
          </InsightCard>
        </motion.div>

        {/* Spending Velocity */}
        <motion.div variants={item}>
          <InsightCard icon={Activity} title="Daily Burn Rate" color="#ff6b35">
            {(() => {
              if (!envelopes) return <div className="text-muted-foreground">No data</div>
              const totalSpent = envelopes.envelopes.reduce((s, e) => s + e.spent, 0)
              const daysElapsed = Math.max(1, new Date().getDate())
              const dailyBurn = Math.round(totalSpent / daysElapsed)
              const totalBudget = envelopes.envelopes.reduce((s, e) => s + e.limit, 0)
              const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
              const targetDaily = Math.round(totalBudget / daysInMonth)
              return (
                <>
                  <div className="text-display text-xl font-bold text-foreground">
                    ₹{dailyBurn.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    target: ₹{targetDaily.toLocaleString()}/day
                  </div>
                  {dailyBurn > targetDaily ? (
                    <p className="text-xs text-danger mt-2">
                      ⚠️ ₹{(dailyBurn - targetDaily).toLocaleString()} above target
                    </p>
                  ) : (
                    <p className="text-xs text-success mt-2">
                      ✅ ₹{(targetDaily - dailyBurn).toLocaleString()} under target
                    </p>
                  )}
                </>
              )
            })()}
          </InsightCard>
        </motion.div>

        {/* Budget Recommendations */}
        <motion.div variants={item}>
          <InsightCard icon={Lightbulb} title="Smart Adjustments" color="#b06aff">
            {(() => {
              if (!envelopes) return <div className="text-muted-foreground">No data</div>
              const overSpent = envelopes.envelopes.filter(e => e.spent > e.limit)
              const underSpent = envelopes.envelopes.filter(e => e.spent < e.limit * 0.5)
              if (overSpent.length === 0) return (
                <>
                  <div className="text-foreground font-semibold">Great job!</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    No budget adjustments needed
                  </div>
                </>
              )
              const recommendIncrease = overSpent[0]
              return (
                <>
                  <div className="text-foreground font-semibold">
                    Consider +₹{Math.round((recommendIncrease.spent - recommendIncrease.limit) * 1.2).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    for {recommendIncrease.category} next month
                  </div>
                  {underSpent.length > 0 && (
                    <div className="text-xs text-success mt-2">
                      Reallocate from {underSpent[0].category}
                    </div>
                  )}
                </>
              )
            })()}
          </InsightCard>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
