import type { Transaction, Category, Stats } from '@/types'
import type { DayFilter } from '@/components/dashboard/DashboardFilters'
import { parseLocalDate, toLocalDateKey } from '@/lib/utils'

export interface YearlyTrendPoint {
  date: string   // "YYYY-MM" — always 12 entries for a full year
  total: number  // 0 for months with no transactions
}

export interface MonthMetrics {
  month: string          // "YYYY-MM"
  totalSpend: number
  byCategory: Record<string, number>
  dailyAverage: number   // totalSpend / count of distinct active days (0 if no transactions)
  transactionCount: number
  byMode: { Online: number; Cash: number; Card: number }
  topCategory: string
}

export function computeMonthMetrics(
  transactions: Transaction[],
  month: string,           // "YYYY-MM"
): MonthMetrics {
  const txs = transactions.filter(t => {
    const dk = t.dateKey || toLocalDateKey(t.date)
    return dk.startsWith(month)
  })

  const totalSpend = txs.reduce((s, t) => s + t.amount, 0)
  const transactionCount = txs.length

  const catMap: Record<string, number> = {}
  for (const t of txs) {
    catMap[t.category] = (catMap[t.category] ?? 0) + t.amount
  }

  const activeDays = new Set(txs.map(t => t.dateKey || toLocalDateKey(t.date))).size
  const dailyAverage = activeDays > 0 ? totalSpend / activeDays : 0

  const byMode = { Online: 0, Cash: 0, Card: 0 }
  for (const t of txs) {
    const mode = t.mode as 'Online' | 'Cash' | 'Card'
    byMode[mode] = (byMode[mode] ?? 0) + t.amount
  }

  const topCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''

  return { month, totalSpend, byCategory: catMap, dailyAverage, transactionCount, byMode, topCategory }
}

export function getAvailableMonths(transactions: Transaction[]): string[] {
  const months = new Set<string>()
  transactions.forEach(t => {
    const d = t.dateKey || toLocalDateKey(t.date)
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
    const d = t.dateKey || toLocalDateKey(t.date)
    const [y, m] = d.split('-')
    if (`${y}-${m}` !== month) return false

    const day = parseLocalDate(d).getDay()
    if (dayFilter === 'weekday') return day >= 1 && day <= 5
    if (dayFilter === 'weekend') return day === 0 || day === 6
    return true
  })
}

export function computeFilteredStats(transactions: Transaction[]): Stats | null {
  if (!transactions.length) return null

  const totalSpent = transactions.reduce((s, t) => s + t.amount, 0)

  const catMap = new Map<Category, { total: number; count: number }>()
  transactions.forEach(t => {
    const category = (t.category || 'Other') as Category
    const existing = catMap.get(category) || { total: 0, count: 0 }
    catMap.set(category, { total: existing.total + t.amount, count: existing.count + 1 })
  })
  const byCategory = Array.from(catMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.total - a.total)

  const dateMap = new Map<string, number>()
  transactions.forEach(t => {
    const d = t.dateKey || toLocalDateKey(t.date)
    dateMap.set(d, (dateMap.get(d) || 0) + t.amount)
  })
  const byDate = Array.from(dateMap.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const byMode = { Online: 0, Cash: 0, Card: 0 }
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

export function computeYearlyTrend(
  transactions: Transaction[],
  year: number,
): YearlyTrendPoint[] {
  const yearStr = String(year)
  const monthMap = new Map<string, number>()
  // Pre-populate all 12 months with 0
  for (let m = 1; m <= 12; m++) {
    monthMap.set(`${yearStr}-${String(m).padStart(2, '0')}`, 0)
  }
  transactions.forEach(t => {
    const dk = t.dateKey || toLocalDateKey(t.date)
    if (!dk.startsWith(yearStr)) return
    const monthKey = dk.slice(0, 7)
    monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + t.amount)
  })
  return Array.from(monthMap.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
