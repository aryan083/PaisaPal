import type { Transaction, Category, Stats } from '@/types'
import type { DayFilter } from '@/components/dashboard/DashboardFilters'

export function getAvailableMonths(transactions: Transaction[]): string[] {
  const months = new Set<string>()
  transactions.forEach(t => {
    const d = t.date.split('T')[0]
    const [y, m] = d.split('-')
    months.add(`${y}-${m}`)
  })
  return Array.from(months).sort().reverse()
}

export function filterTransactions(
  transactions: Transaction[],
  month: string,
  dayFilter: DayFilter
): Transaction[] {
  return transactions.filter(t => {
    const d = t.date.split('T')[0]
    const [y, m] = d.split('-')
    if (`${y}-${m}` !== month) return false

    if (dayFilter !== 'all') {
      const day = new Date(d).getDay()
      const isWeekend = day === 0 || day === 6
      if (dayFilter === 'weekday' && isWeekend) return false
      if (dayFilter === 'weekend' && !isWeekend) return false
    }
    return true
  })
}

export function computeFilteredStats(transactions: Transaction[]): Stats | null {
  if (!transactions.length) return null

  const totalSpent = transactions.reduce((s, t) => s + t.amount, 0)

  const catMap = new Map<Category, { total: number; count: number }>()
  transactions.forEach(t => {
    const existing = catMap.get(t.category) || { total: 0, count: 0 }
    catMap.set(t.category, { total: existing.total + t.amount, count: existing.count + 1 })
  })
  const byCategory = Array.from(catMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.total - a.total)

  const dateMap = new Map<string, number>()
  transactions.forEach(t => {
    const d = t.date.split('T')[0]
    dateMap.set(d, (dateMap.get(d) || 0) + t.amount)
  })
  const byDate = Array.from(dateMap.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const byMode = { Online: 0, Cash: 0 }
  transactions.forEach(t => { byMode[t.mode] += t.amount })

  const activeDays = dateMap.size
  const dailyAverage = activeDays > 0 ? Math.round(totalSpent / activeDays) : 0

  let biggestDay = { date: '', total: 0 }
  byDate.forEach(d => { if (d.total > biggestDay.total) biggestDay = d })

  const biggestTransaction = transactions.reduce<Transaction | null>(
    (max, t) => (!max || t.amount > max.amount ? t : max), null
  )

  const rapidoTxs = transactions.filter(t => t.category === 'Rapido')
  const rapidoTotal = rapidoTxs.reduce((s, t) => s + t.amount, 0)
  const rapidoStats = {
    total: rapidoTotal,
    count: rapidoTxs.length,
    avgPerRide: rapidoTxs.length > 0 ? Math.round(rapidoTotal / rapidoTxs.length) : 0,
  }

  return {
    totalSpent, byCategory, byDate, byMode,
    transactionCount: transactions.length,
    activeDays, dailyAverage, biggestDay, biggestTransaction, rapidoStats,
  }
}
