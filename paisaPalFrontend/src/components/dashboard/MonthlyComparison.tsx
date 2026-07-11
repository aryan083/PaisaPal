import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useStore } from '@/store'
import { computeMonthMetrics, getAvailableMonths } from '@/lib/dashboardUtils'
import { formatCurrency } from '@/lib/utils'

type MetricTab = 'totalSpend' | 'byCategory' | 'dailyAverage' | 'transactionCount' | 'byMode'

const TAB_LABELS: Record<MetricTab, string> = {
  totalSpend: 'Total Spend',
  byCategory: 'By Category',
  dailyAverage: 'Daily Average',
  transactionCount: 'Tx Count',
  byMode: 'Mode Split',
}

const MONTH_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 160 60% 55%))',
  'hsl(var(--chart-3, 30 80% 55%))',
]

function monthLabel(m: string): string {
  const [y, mo] = m.split('-')
  const date = new Date(Number(y), Number(mo) - 1, 1)
  return date.toLocaleString('default', { month: 'short', year: '2-digit' })
}

export function MonthlyComparison() {
  const transactions = useStore(s => s.transactions)

  const allMonths = useMemo(() => getAvailableMonths(transactions), [transactions])

  const defaultMonths = useMemo(() => {
    if (allMonths.length >= 2) return allMonths.slice(0, 2)
    return [...allMonths]
  }, [allMonths])

  const [selectedMonths, setSelectedMonths] = useState<string[]>(defaultMonths)
  const [activeMetric, setActiveMetric] = useState<MetricTab>('totalSpend')

  // Keep selectedMonths in sync if transactions change (e.g. first load)
  const effectiveSelected = useMemo(() => {
    const valid = selectedMonths.filter(m => allMonths.includes(m))
    if (valid.length >= 2) return valid
    // fallback to default
    if (allMonths.length >= 2) return allMonths.slice(0, 2)
    return allMonths.slice()
  }, [selectedMonths, allMonths])

  function toggleMonth(m: string) {
    setSelectedMonths(prev => {
      if (prev.includes(m)) {
        if (prev.length <= 2) return prev          // cannot go below 2
        return prev.filter(x => x !== m)
      }
      if (prev.length >= 3) return prev             // cannot exceed 3
      return [...prev, m].sort().reverse()
    })
  }

  const metrics = useMemo(
    () => effectiveSelected.map(m => computeMonthMetrics(transactions, m)),
    [transactions, effectiveSelected],
  )

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (activeMetric === 'totalSpend') {
      return metrics.map(m => ({ name: monthLabel(m.month), value: m.totalSpend }))
    }
    if (activeMetric === 'dailyAverage') {
      return metrics.map(m => ({ name: monthLabel(m.month), value: m.dailyAverage }))
    }
    if (activeMetric === 'transactionCount') {
      return metrics.map(m => ({ name: monthLabel(m.month), value: m.transactionCount }))
    }
    if (activeMetric === 'byMode') {
      // rows: one per mode, cols: one per month
      const modes: Array<'Online' | 'Cash' | 'Card'> = ['Online', 'Cash', 'Card']
      return modes.map(mode => {
        const row: Record<string, unknown> = { name: mode }
        metrics.forEach(m => { row[monthLabel(m.month)] = m.byMode[mode] })
        return row
      })
    }
    // byCategory: rows = category, cols = month
    const allCats = Array.from(
      new Set(metrics.flatMap(m => Object.keys(m.byCategory))),
    ).sort()
    return allCats.map(cat => {
      const row: Record<string, unknown> = { name: cat }
      metrics.forEach(m => { row[monthLabel(m.month)] = m.byCategory[cat] ?? 0 })
      return row
    })
  }, [metrics, activeMetric])

  // ── Summary row ───────────────────────────────────────────────────────────
  const summaryRow = useMemo(() => {
    if (effectiveSelected.length < 2) return null
    if (activeMetric === 'byCategory' || activeMetric === 'byMode') return null

    const getVal = (m: (typeof metrics)[number]) => {
      if (activeMetric === 'totalSpend') return m.totalSpend
      if (activeMetric === 'dailyAverage') return m.dailyAverage
      return m.transactionCount
    }

    const values = metrics.map(getVal)
    const max = Math.max(...values)
    const min = Math.min(...values)
    if (max === 0) return null

    const pct = Math.round((max - min) / max * 100)
    const cheapestIdx = values.indexOf(min)
    const priciest = metrics.find((_, i) => values[i] === max)
    const cheapest = metrics[cheapestIdx]
    if (!cheapest || !priciest || cheapest.month === priciest.month) return null

    const metricName =
      activeMetric === 'totalSpend' ? 'total spend'
        : activeMetric === 'dailyAverage' ? 'daily average'
          : 'transaction count'

    return `${monthLabel(cheapest.month)} had ${pct}% lower ${metricName} than ${monthLabel(priciest.month)}`
  }, [metrics, effectiveSelected, activeMetric])

  // ── Scalar vs multi-series ────────────────────────────────────────────────
  const isScalar = activeMetric === 'totalSpend' || activeMetric === 'dailyAverage' || activeMetric === 'transactionCount'

  const isCurrencyMetric = activeMetric !== 'transactionCount'

  if (allMonths.length === 0) {
    return (
      <div className="card-base p-5">
        <h3 className="text-display text-sm font-semibold text-foreground mb-2">Monthly Comparison</h3>
        <p className="text-sm text-muted-foreground">Add some transactions to see monthly comparisons.</p>
      </div>
    )
  }

  return (
    <div className="card-base p-5">
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">Monthly Comparison</h3>

      {/* Month picker */}
      <div className="flex flex-wrap gap-2 mb-4">
        {allMonths.map((m, i) => {
          const selected = effectiveSelected.includes(m)
          const colorIdx = effectiveSelected.indexOf(m)
          return (
            <button
              key={m}
              onClick={() => toggleMonth(m)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                selected
                  ? 'border-transparent text-white'
                  : 'border-border text-muted-foreground hover:border-primary hover:text-foreground'
              }`}
              style={selected ? { backgroundColor: MONTH_COLORS[colorIdx] ?? MONTH_COLORS[0] } : {}}
              aria-pressed={selected}
            >
              {monthLabel(m)}
            </button>
          )
        })}
        <span className="self-center text-xs text-muted-foreground ml-1">Pick 2–3 months</span>
      </div>

      {/* Metric tabs */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-border">
        {(Object.keys(TAB_LABELS) as MetricTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveMetric(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors -mb-px border-b-2 ${
              activeMetric === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Chart */}
      {metrics.every(m =>
        activeMetric === 'totalSpend' ? m.totalSpend === 0
          : activeMetric === 'dailyAverage' ? m.dailyAverage === 0
            : activeMetric === 'transactionCount' ? m.transactionCount === 0
              : activeMetric === 'byMode' ? Object.values(m.byMode).every(v => v === 0)
                : Object.keys(m.byCategory).length === 0
      ) ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
          No transaction data for selected months
        </div>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 5, left: isScalar ? 0 : -10, bottom: 0 }}
            >
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v =>
                  isCurrencyMetric && activeMetric !== 'transactionCount'
                    ? `₹${Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : v}`
                    : String(v)
                }
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={isScalar ? 48 : 36}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  isCurrencyMetric && activeMetric !== 'transactionCount'
                    ? formatCurrency(value)
                    : value,
                  name,
                ]}
                cursor={{ fill: 'hsl(var(--secondary))' }}
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'hsl(var(--foreground))',
                }}
              />
              {!isScalar && <Legend wrapperStyle={{ fontSize: 11 }} />}

              {isScalar
                ? effectiveSelected.map((m, i) => (
                    <Bar
                      key={m}
                      dataKey="value"
                      name={monthLabel(m)}
                      fill={MONTH_COLORS[i] ?? MONTH_COLORS[0]}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    />
                  ))
                : effectiveSelected.map((m, i) => (
                    <Bar
                      key={m}
                      dataKey={monthLabel(m)}
                      fill={MONTH_COLORS[i] ?? MONTH_COLORS[0]}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={32}
                    />
                  ))
              }
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary row */}
      {summaryRow && (
        <p className="mt-3 text-xs text-muted-foreground italic">{summaryRow}</p>
      )}
    </div>
  )
}
