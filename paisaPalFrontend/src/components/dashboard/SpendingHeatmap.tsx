import type { Transaction } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  transactions: Transaction[]
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function SpendingHeatmap({ transactions }: Props) {
  // Group spending by day of week
  const byDay = new Array(7).fill(0)
  const countByDay = new Array(7).fill(0)
  transactions.forEach(t => {
    const day = new Date(t.date).getDay()
    byDay[day] += t.amount
    countByDay[day]++
  })

  const maxSpend = Math.max(...byDay, 1)

  return (
    <div className="card-base p-5">
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">Spending by Day of Week</h3>
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((day, i) => {
          const intensity = byDay[i] / maxSpend
          const opacity = Math.max(0.08, intensity)
          return (
            <div key={day} className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-medium">{day}</span>
              <div
                className="w-full aspect-square rounded-lg flex items-center justify-center transition-colors"
                style={{ background: `hsl(var(--primary) / ${opacity})` }}
                title={`${day}: ${formatCurrency(byDay[i])} (${countByDay[i]} txns)`}
              >
                <span className="text-[10px] font-semibold text-foreground">
                  {byDay[i] > 0 ? `₹${Math.round(byDay[i])}` : '–'}
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground">{countByDay[i]} txn{countByDay[i] !== 1 ? 's' : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
