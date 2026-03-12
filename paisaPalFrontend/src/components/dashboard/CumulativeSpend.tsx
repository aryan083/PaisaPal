import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { formatCurrency, formatDateShort } from '@/lib/utils'
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
              labelFormatter={formatDateShort}
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                fontSize: '12px',
                color: 'hsl(var(--foreground))',
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
