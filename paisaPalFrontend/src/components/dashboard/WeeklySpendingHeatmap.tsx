import React from 'react'
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
  dayFilter: DayFilter
}

function getWeekOfMonth(dateStr: string): number {
  const d = parseLocalDate(dateStr)
  const day = d.getDate()
  return Math.min(5, Math.floor((day - 1) / 7) + 1)
}

export function WeeklySpendingHeatmap({ transactions, dayFilter }: Props) {
  const dayIndexes = (() => {
    if (dayFilter === 'weekday') return [1, 2, 3, 4, 5]
    if (dayFilter === 'weekend') return [0, 6]
    return [0, 1, 2, 3, 4, 5, 6]
  })()

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const total = new Array(5)
    .fill(null)
    .map(() => new Array(7).fill(0))
  const count = new Array(5)
    .fill(null)
    .map(() => new Array(7).fill(0))
  const txns = new Array(5)
    .fill(null)
    .map(() => new Array(7).fill(null).map(() => [] as Transaction[]))

  transactions.forEach(t => {
    const w = getWeekOfMonth(t.date)
    const dow = parseLocalDate(t.date).getDay()
    total[w - 1][dow] += t.amount
    count[w - 1][dow] += 1
    txns[w - 1][dow].push(t)
  })

  const maxSpend = Math.max(
    ...total.flatMap((row, w) => dayIndexes.map(d => row[d])),
    1,
  )

  return (
    <div className="card-base p-5">
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">
        Week × Day Spend
      </h3>

      <TooltipProvider>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `56px repeat(${dayIndexes.length}, minmax(0, 1fr))` }}
        >
          <div />
          {dayIndexes.map(i => (
            <div
              key={i}
              className="text-[10px] text-muted-foreground font-medium text-center"
            >
              {dayLabels[i]}
            </div>
          ))}

          {[1, 2, 3, 4, 5].map((week, wi) => (
            <React.Fragment key={`week-row-${week}`}>
              <div className="text-[10px] text-muted-foreground font-medium flex items-center">
                W{week}
              </div>
              {dayIndexes.map(di => {
                const v = total[wi][di]
                const c = count[wi][di]
                const intensity = v / maxSpend
                const opacity = v > 0 ? Math.max(0.08, intensity) : 0.04
                const list = [...txns[wi][di]].sort(
                  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
                )

                return (
                  <Tooltip key={`w-${week}-d-${di}`}>
                    <TooltipTrigger asChild>
                      <div
                        className="h-9 rounded-lg border border-border/60 flex items-center justify-center"
                        style={{ background: `hsl(var(--primary) / ${opacity})` }}
                      >
                        <span className="text-[10px] font-semibold text-foreground">
                          {v > 0 ? `₹${Math.round(v)}` : '–'}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[320px]">
                      <div className="text-xs">
                        <div className="font-medium text-foreground">Week {week} · {dayLabels[di]}</div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-semibold text-foreground">{formatCurrency(v)}</span>
                        </div>
                        <div className="mt-2 border-t border-border pt-2">
                          {list.length === 0 ? (
                            <div className="text-muted-foreground">No transactions</div>
                          ) : (
                            <div className="grid gap-1">
                              {list.slice(0, 6).map(t => (
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
                              {list.length > 6 && (
                                <div className="text-muted-foreground">+{list.length - 6} more</div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-[10px] text-muted-foreground">
                          {c} txn{c !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </TooltipProvider>
    </div>
  )
}
