import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getCategoryHex } from '@/types'
import { formatCurrency } from '@/lib/utils'
import type { Stats } from '@/types'
import { useStore } from '@/store'

interface Props {
  stats: Stats | null
}

export function TopCategories({ stats }: Props) {
  const { settings } = useStore()
  const data = stats?.byCategory.slice(0, 5) ?? []

  return (
    <div className="card-base p-5">
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">Top Categories</h3>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 5, left: 5, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="category"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const p = payload[0]
                const v = typeof p.value === 'number' ? p.value : Number(p.value)
                const cat = typeof label === 'string' ? label : String(label)

                return (
                  <div
                    className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs shadow-xl"
                    style={{ color: 'hsl(var(--foreground))' }}
                  >
                    <div className="font-medium text-foreground">{cat}</div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Spent</span>
                      <span className="font-semibold text-foreground">{formatCurrency(v)}</span>
                    </div>
                  </div>
                )
              }}
            />
            <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={16}>
              {data.map(entry => (
                <Cell key={entry.category} fill={getCategoryHex(entry.category, settings)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {data.map(c => (
          <div key={c.category} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ background: getCategoryHex(c.category, settings) }} />
              <span className="text-muted-foreground">{c.category}</span>
            </div>
            <span className="font-medium text-foreground">{formatCurrency(c.total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
