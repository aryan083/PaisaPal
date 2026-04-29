import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getCategoryHex } from '@/types'
import { formatCurrency } from '@/lib/utils'
import type { Stats } from '@/types'
import { useStore } from '@/store'

interface Props {
  stats: Stats | null
}

export function AvgTransactionByCategory({ stats }: Props) {
  const { settings } = useStore()
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
              cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0]
                const v = typeof p.value === 'number' ? p.value : Number(p.value)
                const cat = (p.payload as { category: string; count: number }).category
                const count = (p.payload as { category: string; count: number }).count

                return (
                  <div
                    className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs shadow-xl"
                    style={{ color: 'hsl(var(--foreground))' }}
                  >
                    <div className="font-medium text-foreground">{cat}</div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Avg</span>
                      <span className="font-semibold text-foreground">{formatCurrency(v)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Transactions</span>
                      <span className="font-semibold text-foreground">{count}</span>
                    </div>
                  </div>
                )
              }}
            />
            <Bar dataKey="avg" radius={[6, 6, 0, 0]} barSize={24}>
              {data.map(entry => (
                <Cell key={entry.category} fill={getCategoryHex(entry.category, settings)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
