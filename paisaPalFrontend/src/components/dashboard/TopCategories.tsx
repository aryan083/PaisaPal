import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { CATEGORY_HEX, type Category } from '@/types'
import { formatCurrency } from '@/lib/utils'
import type { Stats } from '@/types'

interface Props {
  stats: Stats | null
}

export function TopCategories({ stats }: Props) {
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
              formatter={(value: number) => [formatCurrency(value), 'Spent']}
              labelFormatter={(label: string) => label}
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                fontSize: '12px',
                color: 'hsl(var(--foreground))',
              }}
            />
            <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={16}>
              {data.map(entry => (
                <Cell key={entry.category} fill={CATEGORY_HEX[entry.category as Category]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {data.map(c => (
          <div key={c.category} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ background: CATEGORY_HEX[c.category as Category] }} />
              <span className="text-muted-foreground">{c.category}</span>
            </div>
            <span className="font-medium text-foreground">{formatCurrency(c.total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
