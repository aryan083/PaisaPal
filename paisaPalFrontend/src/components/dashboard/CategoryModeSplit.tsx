import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { CATEGORIES, type Transaction } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  transactions: Transaction[]
}

export function CategoryModeSplit({ transactions }: Props) {
  const data = CATEGORIES.map(cat => {
    let online = 0, cash = 0
    transactions.forEach(t => {
      if (t.category === cat) {
        if (t.mode === 'Online') online += t.amount
        else cash += t.amount
      }
    })
    return { category: cat, Online: online, Cash: cash }
  }).filter(d => d.Online > 0 || d.Cash > 0)

  return (
    <div className="card-base p-5">
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">Category × Payment Mode</h3>
      <div className="h-[200px]">
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
              height={45}
            />
            <YAxis
              tickFormatter={v => `₹${v}`}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatCurrency(value), name]}
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                fontSize: '12px',
                color: 'hsl(var(--foreground))',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="Online" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Cash" stackId="a" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
