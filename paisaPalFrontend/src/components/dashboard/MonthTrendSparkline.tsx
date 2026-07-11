import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useStore } from '@/store'
import { getAvailableMonths, computeMonthMetrics } from '@/lib/dashboardUtils'
import { formatCurrency } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SparklineDataPoint {
  month: string   // "YYYY-MM"
  total: number   // sum of transaction amounts in that month
  label: string   // "Jan '25"
}

type TrendInfo =
  | { direction: 'up' | 'down'; pct: number;   oldestLabel: string }
  | { direction: 'neutral';     pct: null;      oldestLabel: string }
  | null

// ── Tooltip ───────────────────────────────────────────────────────────────────

function SparklineTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs shadow-xl">
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Total</span>
        <span className="font-semibold text-foreground">
          {formatCurrency(payload[0].value as number)}
        </span>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function MonthTrendSparkline(): JSX.Element {
  const transactions = useStore(s => s.transactions)

  // Compute the 6 most recent months with data, sorted oldest-to-newest for chart
  const sparklineData = useMemo((): SparklineDataPoint[] => {
    const months = getAvailableMonths(transactions) // sorted newest-first
    const recent = months.slice(0, 6).reverse()     // take 6, flip to oldest-first
    return recent.map(month => {
      const { totalSpend } = computeMonthMetrics(transactions, month)
      const [y, m] = month.split('-')
      const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-IN', {
        month: 'short',
        year: '2-digit',
      })
      return { month, total: totalSpend, label }
    })
  }, [transactions])

  // Compute trend info between oldest and newest data point
  const trendInfo = useMemo((): TrendInfo => {
    if (sparklineData.length < 2) return null
    const oldest = sparklineData[0].total
    const newest = sparklineData[sparklineData.length - 1].total
    if (oldest === 0) {
      return { direction: 'neutral', pct: null, oldestLabel: sparklineData[0].label }
    }
    const pct = Math.round(Math.abs(newest - oldest) / oldest * 100)
    const direction = newest >= oldest ? 'up' : 'down'
    return { direction, pct, oldestLabel: sparklineData[0].label }
  }, [sparklineData])

  return (
    <div className="card-base p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-display text-sm font-semibold text-foreground">
            6-Month Spending Trend
          </h3>
          {trendInfo && (
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              {trendInfo.direction === 'up' && (
                <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--danger))]" />
              )}
              {trendInfo.direction === 'down' && (
                <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
              )}
              {trendInfo.direction === 'neutral' && (
                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {trendInfo.pct !== null ? (
                <span
                  className={
                    trendInfo.direction === 'up'
                      ? 'text-[hsl(var(--danger))]'
                      : 'text-emerald-500'
                  }
                >
                  {trendInfo.pct}% vs {trendInfo.oldestLabel}
                </span>
              ) : (
                <span className="text-muted-foreground">No baseline</span>
              )}
            </div>
          )}
        </div>
      </div>

      {sparklineData.length < 2 ? (
        <p className="text-xs text-muted-foreground text-center py-8">
          Not enough data — need at least 2 months of transactions.
        </p>
      ) : (
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => `₹${v}`}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<SparklineTooltip />} cursor={{ stroke: 'hsl(var(--border))' }} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#sparkGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
