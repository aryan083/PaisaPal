import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { getCategoryHex } from '@/types'
import { formatCurrency } from '@/lib/utils'
import type { Stats } from '@/types'
import { useStore } from '@/store'

interface Props {
  stats: Stats | null
}

export function CategoryDonut({ stats }: Props) {
  const { settings } = useStore()
  const data = stats?.byCategory.filter(c => c.total > 0) ?? []

  return (
    <div className="card-base p-5">
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">Spending by Category</h3>
      <div className="flex items-center gap-4">
        <div className="h-[160px] w-[160px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                strokeWidth={2}
                stroke="hsl(var(--card))"
              >
                {data.map(entry => (
                  <Cell key={entry.category} fill={getCategoryHex(entry.category, settings)} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0]
                  const v = typeof p.value === 'number' ? p.value : Number(p.value)
                  const l = typeof label === 'string' ? label : String(label)

                  return (
                    <div
                      className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs shadow-xl"
                      style={{ color: 'hsl(var(--foreground))' }}
                    >
                      <div className="font-medium text-foreground">{l}</div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Spent</span>
                        <span className="font-semibold text-foreground">{formatCurrency(v)}</span>
                      </div>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-1.5 overflow-hidden">
          {data.slice(0, 5).map(c => (
            <div key={c.category} className="flex items-center gap-2 text-xs">
              <div
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ background: getCategoryHex(c.category, settings) }}
              />
              <span className="text-muted-foreground truncate">{c.category}</span>
              <span className="ml-auto font-medium text-foreground">{formatCurrency(c.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
