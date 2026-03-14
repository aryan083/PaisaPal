import { useMemo } from 'react'
import type { Transaction } from '@/types'
import { formatCurrency, formatDateWithWeekday, toLocalDateKey } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface Props {
  transactions: Transaction[]
  selectedMonth: string // YYYY-MM
}

type DayCell = {
  date: string
  dayOfMonth: number
  total: number
  txns: Transaction[]
}

function buildMonthDays(selectedMonth: string): string[] {
  const [y, m] = selectedMonth.split('-').map(Number)
  const last = new Date(y, m, 0)
  const days: string[] = []
  for (let d = 1; d <= last.getDate(); d++) {
    const dt = new Date(y, m - 1, d)
    days.push(toLocalDateKey(dt))
  }
  return days
}

export function SpendingCalendar({ transactions, selectedMonth }: Props) {
  const txByDate = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    transactions.forEach(t => {
      const d = t.dateKey || toLocalDateKey(t.date)
      map.set(d, [...(map.get(d) ?? []), t])
    })
    return map
  }, [transactions])

  const days = useMemo(() => buildMonthDays(selectedMonth), [selectedMonth])

  const cells: DayCell[] = useMemo(() => {
    return days.map(date => {
      const txns = txByDate.get(date) ?? []
      const total = txns.reduce((s, t) => s + t.amount, 0)
      const dayOfMonth = Number(date.split('-')[2])
      return { date, dayOfMonth, total, txns }
    })
  }, [days, txByDate])

  const maxSpend = Math.max(...cells.map(c => c.total), 1)

  const [y, m] = selectedMonth.split('-').map(Number)
  const firstDayOffset = (new Date(y, m - 1, 1).getDay() + 6) % 7 // Mon=0..Sun=6
  const blanks = new Array(firstDayOffset).fill(null)

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="card-base p-5">
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">
        Spending Calendar
      </h3>

      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {weekDays.map(d => (
          <div
            key={d}
            className="text-[9px] font-medium text-muted-foreground text-center"
          >
            {d}
          </div>
        ))}
      </div>

      <TooltipProvider>
        <div className="grid grid-cols-7 gap-1.5">
          {blanks.map((_, idx) => (
            <div key={`blank-${idx}`} className="h-11" />
          ))}

          {cells.map(c => {
            const intensity = c.total / maxSpend
            const opacity = c.total > 0 ? Math.max(0.08, intensity) : 0.04

            return (
              <Tooltip key={c.date}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="h-11 rounded-lg border border-border/60 flex flex-col items-center justify-center bg-card hover:bg-muted transition-colors"
                  >
                    <span className="text-[9px] font-semibold text-foreground">
                      {c.dayOfMonth}
                    </span>
                    <span
                      className="mt-1 h-1.5 w-5 rounded-full"
                      style={{ background: `hsl(var(--primary) / ${opacity})` }}
                    />
                    <span className="mt-1 text-[8px] text-muted-foreground">
                      {c.total > 0 ? `₹${Math.round(c.total)}` : ''}
                    </span>
                  </button>
                </TooltipTrigger>

                <TooltipContent className="max-w-[280px]">
                  <div className="text-xs">
                    <div className="font-medium text-foreground">
                      {formatDateWithWeekday(c.date)}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(c.total)}
                      </span>
                    </div>

                    <div className="mt-2 border-t border-border pt-2">
                      {c.txns.length === 0 ? (
                        <div className="text-muted-foreground">No transactions</div>
                      ) : (
                        <div className="grid gap-1">
                          {c.txns.slice(0, 8).map(t => (
                            <div
                              key={t.id}
                              className="flex items-center justify-between gap-3"
                            >
                              <span className="text-muted-foreground truncate">
                                {t.particulars}
                              </span>
                              <span className="font-medium text-foreground">
                                {formatCurrency(t.amount)}
                              </span>
                            </div>
                          ))}
                          {c.txns.length > 8 && (
                            <div className="text-muted-foreground">
                              +{c.txns.length - 8} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
    </div>
  )
}
