import type { Transaction } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  transactions: Transaction[]
}

type WeekBucket = {
  week: number
  total: number
  count: number
}

function getWeekOfMonth(dateStr: string): number {
  const d = new Date(dateStr)
  const day = d.getDate()
  return Math.min(5, Math.floor((day - 1) / 7) + 1)
}

export function WeeklySpendSummary({ transactions }: Props) {
  const byWeek: WeekBucket[] = [1, 2, 3, 4, 5].map(week => ({
    week,
    total: 0,
    count: 0,
  }))

  transactions.forEach(t => {
    const w = getWeekOfMonth(t.date)
    const idx = w - 1
    byWeek[idx].total += t.amount
    byWeek[idx].count += 1
  })

  const maxSpend = Math.max(...byWeek.map(w => w.total), 1)

  return (
    <div className="card-base p-5">
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">
        Spending by Week
      </h3>
      <div className="grid grid-cols-5 gap-2">
        {byWeek.map(w => {
          const intensity = w.total / maxSpend
          const opacity = w.total > 0 ? Math.max(0.08, intensity) : 0.04

          return (
            <div key={w.week} className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-medium">
                W{w.week}
              </span>
              <div
                className="w-full aspect-square rounded-lg flex items-center justify-center"
                style={{ background: `hsl(var(--primary) / ${opacity})` }}
                title={`Week ${w.week}: ${formatCurrency(w.total)} (${w.count} txns)`}
              >
                <span className="text-[10px] font-semibold text-foreground">
                  {w.total > 0 ? `₹${Math.round(w.total)}` : '–'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
