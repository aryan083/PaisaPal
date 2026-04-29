import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Transaction } from '@/types'
import { useStore } from '@/store'
import { getAvailableCategories } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  transactions: Transaction[]
}

export function CategoryModeSplit({ transactions }: Props) {
  const { settings } = useStore()
  const categories = getAvailableCategories(settings)

  const data = categories.map(cat => {
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
              cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const cat = typeof label === 'string' ? label : String(label)
                const items = payload
                  .filter(p => typeof p.value === 'number' ? p.value > 0 : Number(p.value) > 0)
                  .map(p => ({
                    name: String(p.name),
                    value: typeof p.value === 'number' ? p.value : Number(p.value),
                    color: p.color,
                  }))

                return (
                  <div
                    className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs shadow-xl"
                    style={{ color: 'hsl(var(--foreground))' }}
                  >
                    <div className="font-medium text-foreground">{cat}</div>
                    <div className="mt-1 grid gap-1">
                      {items.map(i => (
                        <div key={i.name} className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">{i.name}</span>
                          <span className="font-semibold text-foreground">{formatCurrency(i.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
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
