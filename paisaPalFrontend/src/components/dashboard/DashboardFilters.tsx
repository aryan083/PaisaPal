import { ChevronLeft, ChevronRight } from 'lucide-react'

export type DayFilter = 'all' | 'weekday' | 'weekend'

interface Props {
  dayFilter: DayFilter
  setDayFilter: (f: DayFilter) => void
  selectedMonth: string // 'YYYY-MM'
  setSelectedMonth: (m: string) => void
  availableMonths: string[]
}

const DAY_OPTIONS: { value: DayFilter; label: string }[] = [
  { value: 'all', label: 'All Days' },
  { value: 'weekday', label: 'Weekdays' },
  { value: 'weekend', label: 'Weekends' },
]

export function DashboardFilters({ dayFilter, setDayFilter, selectedMonth, setSelectedMonth, availableMonths }: Props) {
  const currentIdx = availableMonths.indexOf(selectedMonth)

  const goPrev = () => {
    if (currentIdx < availableMonths.length - 1) setSelectedMonth(availableMonths[currentIdx + 1])
  }
  const goNext = () => {
    if (currentIdx > 0) setSelectedMonth(availableMonths[currentIdx - 1])
  }

  const monthLabel = (() => {
    const [y, m] = selectedMonth.split('-')
    const d = new Date(parseInt(y), parseInt(m) - 1)
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  })()

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Month Navigator */}
      <div className="flex items-center gap-1 rounded-xl bg-secondary px-1 py-1">
        <button
          onClick={goPrev}
          disabled={currentIdx >= availableMonths.length - 1}
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-foreground px-2 min-w-[140px] text-center">{monthLabel}</span>
        <button
          onClick={goNext}
          disabled={currentIdx <= 0}
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day Type Switch */}
      <div className="flex items-center rounded-xl bg-secondary p-1 gap-0.5">
        {DAY_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setDayFilter(opt.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              dayFilter === opt.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
