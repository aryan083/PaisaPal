import { formatCurrency, formatDate } from '@/lib/utils'
import type { Stats } from '@/types'

interface Props {
  stats: Stats | null
}

export function QuickStats({ stats }: Props) {
  if (!stats) return null

  const items = [
    { label: 'Transactions', value: String(stats.transactionCount) },
    { label: 'Active Days', value: String(stats.activeDays) },
    { label: 'Daily Avg', value: formatCurrency(stats.dailyAverage) },
    { label: 'Peak Day', value: stats.biggestDay.date ? formatDate(stats.biggestDay.date) : '—' },
  ]

  return (
    <div className="card-base p-5">
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">Quick Stats</h3>
      <div className="grid grid-cols-2 gap-3">
        {items.map(i => (
          <div key={i.label} className="rounded-xl bg-secondary px-3 py-2">
            <p className="text-[10px] text-muted-foreground">{i.label}</p>
            <p className="text-sm font-semibold text-foreground">{i.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
