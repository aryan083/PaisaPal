import { motion } from 'framer-motion'
import { useStore } from '@/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Bike, TrendingUp, Calendar, CreditCard, Trophy, Lightbulb,
  Activity, ShoppingBag, Flame, BarChart3, Star, Clock,
  ArrowUpDown, Percent, Target, Zap
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
  const { stats, settings, transactions } = useStore()

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

  const onlinePct = stats.byMode.Online + stats.byMode.Cash > 0
    ? Math.round((stats.byMode.Online / (stats.byMode.Online + stats.byMode.Cash)) * 100) : 0

  const dates = transactions.map(t => t.date.split('T')[0]).sort()
  const uniqueDates = [...new Set(dates)]
  let streak = 1
  for (let i = uniqueDates.length - 1; i > 0; i--) {
    const diff = (new Date(uniqueDates[i]).getTime() - new Date(uniqueDates[i - 1]).getTime()) / 86400000
    if (diff === 1) streak++
    else break
  }

  const avgTx = Math.round(stats.totalSpent / stats.transactionCount)
  const mostFrequent = [...stats.byCategory].sort((a, b) => b.count - a.count)[0]

  let weekdaySpend = 0, weekendSpend = 0, weekdayCount = 0, weekendCount = 0
  transactions.forEach(t => {
    const day = new Date(t.date).getDay()
    if (day === 0 || day === 6) { weekendSpend += t.amount; weekendCount++ }
    else { weekdaySpend += t.amount; weekdayCount++ }
  })

  const allDays = new Set<string>()
  if (uniqueDates.length > 0) {
    const start = new Date(uniqueDates[0])
    const end = new Date(uniqueDates[uniqueDates.length - 1])
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      allDays.add(d.toISOString().split('T')[0])
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
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
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
            <p className="text-muted-foreground">{pctUsed}% used · {formatCurrency(Math.max(0, budget - stats.totalSpent))} remaining</p>
            <p className="text-muted-foreground">Daily burn: {formatCurrency(dailyBurn)}</p>
            <p className="text-muted-foreground">Projected: {formatCurrency(projectedTotal)} {projectedTotal > budget ? '⚠️ Over budget!' : '✅ On track'}</p>
          </InsightCard>
        </motion.div>

        <motion.div variants={item}>
          <InsightCard icon={Calendar} title="Peak Spend Day" color="#ff4f6a">
            {stats.biggestDay.date ? (
              <>
                <p className="text-foreground font-semibold">{formatDate(stats.biggestDay.date)}</p>
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
                <p className="text-muted-foreground">{formatCurrency(stats.biggestTransaction.amount)} · {formatDate(stats.biggestTransaction.date)}</p>
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
                <p className="text-muted-foreground">{formatCurrency(smallest.amount)} · {formatDate(smallest.date)}</p>
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
      </motion.div>
    </motion.div>
  )
}
