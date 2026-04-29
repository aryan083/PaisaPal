import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatDateShort, formatDateShortWithWeekday } from '@/lib/utils'
import type { Stats } from '@/types'

interface Props {
  stats: Stats | null
}

export function DailyTrend({ stats }: Props) {
  const data = stats?.byDate ?? []

  return (
    <div className="card-base p-5">
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">Daily Spending Trend</h3>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="dailyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
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
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), 'Spent']}
              labelFormatter={formatDateShortWithWeekday}
              cursor={{ stroke: 'hsl(var(--border))' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const v = typeof payload[0].value === 'number'
                  ? payload[0].value
                  : Number(payload[0].value)
                const l = typeof label === 'string' ? label : String(label)

                return (
                  <div
                    className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs shadow-xl"
                    style={{ color: 'hsl(var(--foreground))' }}
                  >
                    <div className="font-medium text-foreground">{formatDateShortWithWeekday(l)}</div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Spent</span>
                      <span className="font-semibold text-foreground">{formatCurrency(v)}</span>
                    </div>
                  </div>
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#dailyGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
