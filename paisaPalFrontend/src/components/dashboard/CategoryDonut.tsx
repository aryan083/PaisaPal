import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { CATEGORY_HEX, type Category } from '@/types'
import { formatCurrency } from '@/lib/utils'
import type { Stats } from '@/types'

interface Props {
  stats: Stats | null
}

export function CategoryDonut({ stats }: Props) {
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
                  <Cell key={entry.category} fill={CATEGORY_HEX[entry.category as Category]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: 'hsl(var(--foreground))',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-1.5 overflow-hidden">
          {data.slice(0, 5).map(c => (
            <div key={c.category} className="flex items-center gap-2 text-xs">
              <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: CATEGORY_HEX[c.category as Category] }} />
              <span className="text-muted-foreground truncate">{c.category}</span>
              <span className="ml-auto font-medium text-foreground">{formatCurrency(c.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
