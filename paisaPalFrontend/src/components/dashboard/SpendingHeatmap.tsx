import type { Transaction } from '@/types'
import { formatCurrency, formatDateShortWithWeekday, parseLocalDate } from '@/lib/utils'
import type { DayFilter } from './DashboardFilters'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface Props {
  transactions: Transaction[]
  dayFilter?: DayFilter
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function SpendingHeatmap({ transactions, dayFilter = 'all' }: Props) {
  // Group spending by day of week
  const byDay = new Array(7).fill(0)
  const countByDay = new Array(7).fill(0)
  const txnsByDay: Transaction[][] = new Array(7).fill(null).map(() => [])
  transactions.forEach(t => {
    const day = parseLocalDate(t.date).getDay()
    byDay[day] += t.amount
    countByDay[day]++
    txnsByDay[day].push(t)
  })

  const maxSpend = Math.max(...byDay, 1)

  const visibleIndexes = (() => {
    if (dayFilter === 'weekday') return [1, 2, 3, 4, 5]
    if (dayFilter === 'weekend') return [0, 6]
    return [0, 1, 2, 3, 4, 5, 6]
  })()

  return (
    <div className="card-base p-5">
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">Spending by Day of Week</h3>
      <TooltipProvider>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${visibleIndexes.length}, minmax(0, 1fr))` }}
        >
          {visibleIndexes.map((i) => {
            const day = DAYS[i]
            const intensity = byDay[i] / maxSpend
            const opacity = Math.max(0.08, intensity)
            const txns = [...txnsByDay[i]].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
            )

            return (
              <div key={day} className="flex flex-col items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-medium">{day}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="w-full aspect-square rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: `hsl(var(--primary) / ${opacity})` }}
                    >
                      <span className="text-[10px] font-semibold text-foreground">
                        {byDay[i] > 0 ? `₹${Math.round(byDay[i])}` : '–'}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[320px]">
                    <div className="text-xs">
                      <div className="font-medium text-foreground">{day}</div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-semibold text-foreground">{formatCurrency(byDay[i])}</span>
                      </div>
                      <div className="mt-2 border-t border-border pt-2">
                        {txns.length === 0 ? (
                          <div className="text-muted-foreground">No transactions</div>
                        ) : (
                          <div className="grid gap-1">
                            {txns.slice(0, 8).map(t => (
                              <div key={t.id} className="grid gap-0.5">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground truncate">{t.particulars}</span>
                                  <span className="font-medium text-foreground">{formatCurrency(t.amount)}</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {formatDateShortWithWeekday(t.date)}
                                </div>
                              </div>
                            ))}
                            {txns.length > 8 && (
                              <div className="text-muted-foreground">+{txns.length - 8} more</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
                <span className="text-[9px] text-muted-foreground">{countByDay[i]} txn{countByDay[i] !== 1 ? 's' : ''}</span>
              </div>
            )
          })}
        </div>
      </TooltipProvider>
    </div>
  )
}
