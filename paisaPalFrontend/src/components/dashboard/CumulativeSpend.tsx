import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { formatCurrency, formatDateShort, formatDateShortWithWeekday } from '@/lib/utils'
import type { Stats } from '@/types'

interface Props {
  stats: Stats | null
  budget: number
}

export function CumulativeSpend({ stats, budget }: Props) {
  const byDate = stats?.byDate ?? []

  let cumulative = 0
  const data = byDate.map(d => {
    cumulative += d.total
    return { date: d.date, total: cumulative }
  })

  return (
    <div className="card-base p-5">
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">Cumulative Spending</h3>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
              formatter={(value: number) => [formatCurrency(value), 'Total Spent']}
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
                      <span className="text-muted-foreground">Total spent</span>
                      <span className="font-semibold text-foreground">{formatCurrency(v)}</span>
                    </div>
                  </div>
                )
              }}
            />
            {budget > 0 && (
              <ReferenceLine
                y={budget}
                stroke="hsl(var(--danger))"
                strokeDasharray="6 3"
                label={{ value: 'Budget', position: 'right', fontSize: 10, fill: 'hsl(var(--danger))' }}
              />
            )}
            <Line
              type="monotone"
              dataKey="total"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
