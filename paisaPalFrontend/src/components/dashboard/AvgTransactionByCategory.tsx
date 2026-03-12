import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { CATEGORY_HEX, type Category } from '@/types'
import { formatCurrency } from '@/lib/utils'
import type { Stats } from '@/types'

interface Props {
  stats: Stats | null
}

export function AvgTransactionByCategory({ stats }: Props) {
  const data = (stats?.byCategory ?? [])
    .filter(c => c.count > 0)
    .map(c => ({
      category: c.category,
      avg: Math.round(c.total / c.count),
      count: c.count,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 6)

  return (
    <div className="card-base p-5">
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">Avg per Transaction</h3>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <XAxis
              dataKey="category"
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={40}
            />
            <YAxis
              tickFormatter={v => `₹${v}`}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number, _name: string, props: { payload: { category: string; count: number } }) => [
                `${formatCurrency(value)} avg (${props.payload.count} txns)`,
                props.payload.category,
              ]}
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                fontSize: '12px',
                color: 'hsl(var(--foreground))',
              }}
            />
            <Bar dataKey="avg" radius={[6, 6, 0, 0]} barSize={24}>
              {data.map(entry => (
                <Cell key={entry.category} fill={CATEGORY_HEX[entry.category as Category]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
