import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CategoryFilterDropdown } from '@/components/dashboard/CategoryFilterDropdown'
import type { Category } from '@/types'

export type DayFilter = 'all' | 'weekday' | 'weekend'

interface Props {
  dayFilter: DayFilter
  setDayFilter: (f: DayFilter) => void
  selectedMonth: string // 'YYYY-MM'
  setSelectedMonth: (m: string) => void
  availableMonths: string[]
  categories: string[]
  selectedCategories: Category[]
  setSelectedCategories: (cats: Category[]) => void
  // Yearly view props
  viewMode: 'monthly' | 'yearly'
  setViewMode: (m: 'monthly' | 'yearly') => void
  selectedYear: number
  setSelectedYear: (y: number) => void
  availableYears: number[]
}

const DAY_OPTIONS: { value: DayFilter; label: string }[] = [
  { value: 'all', label: 'All Days' },
  { value: 'weekday', label: 'Weekdays' },
  { value: 'weekend', label: 'Weekends' },
]

export function DashboardFilters({
  dayFilter,
  setDayFilter,
  selectedMonth,
  setSelectedMonth,
  availableMonths,
  categories,
  selectedCategories,
  setSelectedCategories,
  viewMode,
  setViewMode,
  selectedYear,
  setSelectedYear,
  availableYears,
}: Props) {
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

      {/* ViewMode pill toggle — always visible */}
      <div className="flex items-center rounded-xl bg-secondary p-1 gap-0.5">
        {(['monthly', 'yearly'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              viewMode === mode
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {mode === 'monthly' ? 'Month' : 'Year'}
          </button>
        ))}
      </div>

      {/* Monthly controls — hidden in yearly mode */}
      {viewMode === 'monthly' && (
        <>
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

          <CategoryFilterDropdown
            categories={categories}
            selected={selectedCategories}
            setSelected={setSelectedCategories}
          />
        </>
      )}

      {/* YearSelector — shown in yearly mode */}
      {viewMode === 'yearly' && (
        <div className="flex items-center gap-1 rounded-xl bg-secondary px-1 py-1">
          <button
            onClick={() => setSelectedYear(selectedYear - 1)}
            disabled={!availableYears.includes(selectedYear - 1)}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-foreground px-2 min-w-[60px] text-center">
            {selectedYear}
          </span>
          <button
            onClick={() => setSelectedYear(selectedYear + 1)}
            disabled={selectedYear >= new Date().getFullYear()}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next year"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
