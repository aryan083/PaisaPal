import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Wallet, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useEnvelopes } from '@/hooks/useEnvelopes'
import { getAvailableCategories } from '@/types'
import { useStore } from '@/store'

function getMonthKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return getMonthKey(date)
}

export function EnvelopesPage() {
  const { settings, isSnapshotView } = useStore()
  const [month, setMonth] = useState(getMonthKey(new Date()))
  const { envelope, loading, setup, updateLimits, surplus } = useEnvelopes(month)

  const categories = getAvailableCategories(settings)

  const [setupOpen, setSetupOpen] = useState(false)
  const [limits, setLimits] = useState<Record<string, string>>({})

  const totalBudgeted = useMemo(() => envelope?.envelopes.reduce((s, e) => s + e.limit, 0) ?? 0, [envelope])
  const totalSpent = useMemo(() => envelope?.envelopes.reduce((s, e) => s + e.spent, 0) ?? 0, [envelope])
  const remaining = totalBudgeted - totalSpent

  const openSetup = () => {
    const next: Record<string, string> = {}
    for (const c of categories) {
      next[c] = String(envelope?.envelopes.find((e) => e.category === c)?.limit ?? 0)
    }
    setLimits(next)
    setSetupOpen(true)
  }

  const submitSetup = async () => {
    const items = Object.entries(limits).map(([category, limit]) => ({
      category,
      limit: Math.max(0, Number(limit) || 0),
    }))

    if (!envelope || envelope.envelopes.length === 0) {
      await setup({ month, envelopes: items })
    } else {
      await updateLimits(items)
    }

    setSetupOpen(false)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h1 className="text-display text-2xl font-bold text-foreground">Envelopes</h1>
        </div>
        <button
          onClick={openSetup}
          disabled={isSnapshotView}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Edit Limits
        </button>
      </div>

      <div className="card-base p-5 mb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className="rounded-xl bg-secondary p-2 text-foreground"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-display text-base font-semibold text-foreground">{month}</div>
        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="rounded-xl bg-secondary p-2 text-foreground"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(envelope?.envelopes ?? []).map((e) => {
          const pct = e.limit <= 0 ? 0 : Math.round((e.spent / e.limit) * 100)
          const bar = Math.min(100, Math.max(0, pct))
          const statusColor = e.status === 'over' ? 'bg-red-500' : e.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
          return (
            <div key={e.category} className="card-base p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-display text-sm font-semibold text-foreground">{e.category}</div>
                <div className={cn(
                  'rounded-full px-2 py-1 text-[10px] font-semibold',
                  e.status === 'over'
                    ? 'bg-red-500/10 text-red-500'
                    : e.status === 'warning'
                      ? 'bg-yellow-500/10 text-yellow-500'
                      : 'bg-green-500/10 text-green-500',
                )}>
                  {e.status}
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Limit: {formatCurrency(e.limit)}</div>
              <div className="mt-3 h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div className={cn('h-full rounded-full', statusColor)} style={{ width: `${bar}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{formatCurrency(e.spent)} / {formatCurrency(e.limit)}</span>
                <span className="text-foreground font-semibold">{pct}%</span>
              </div>
              {e.limit - e.spent >= 0 ? (
                <div className="mt-2 text-xs text-muted-foreground">{formatCurrency(e.limit - e.spent)} left</div>
              ) : (
                <div className="mt-2 text-xs text-red-500">Overspent by {formatCurrency(Math.abs(e.limit - e.spent))}</div>
              )}
            </div>
          )
        })}

        {(!envelope || envelope.envelopes.length === 0) && (
          <div className="card-base p-10 text-center text-muted-foreground sm:col-span-2 lg:col-span-3">
            {loading ? 'Loading…' : 'No envelopes configured for this month. Click “Edit Limits” to set them up.'}
          </div>
        )}
      </div>

      <div className="card-base p-5 mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Total budgeted</div>
            <div className="text-display text-xl font-bold text-foreground">{formatCurrency(totalBudgeted)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total spent</div>
            <div className="text-display text-xl font-bold text-foreground">{formatCurrency(totalSpent)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Remaining</div>
            <div className={cn('text-display text-xl font-bold', remaining < 0 ? 'text-red-500' : 'text-foreground')}>
              {remaining < 0 ? `-${formatCurrency(Math.abs(remaining))}` : formatCurrency(remaining)}
            </div>
          </div>
        </div>

        {envelope && remaining > 0 && !isSnapshotView && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => void surplus({ action: 'carry' })}
              className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-foreground"
            >
              Carry surplus
            </button>
          </div>
        )}
      </div>

      <Sheet open={setupOpen} onOpenChange={setSetupOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Envelope Limits · {month}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {categories.map((c) => (
              <div key={c} className="flex items-center justify-between gap-3">
                <div className="text-sm text-foreground">{c}</div>
                <input
                  type="number"
                  value={limits[c] ?? '0'}
                  onChange={(e) => setLimits((s) => ({ ...s, [c]: e.target.value }))}
                  className="w-32 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            ))}
            <button
              onClick={() => void submitSetup()}
              disabled={isSnapshotView}
              className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  )
}
