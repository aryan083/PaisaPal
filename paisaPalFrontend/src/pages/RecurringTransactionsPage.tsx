import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Plus, AlertCircle } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useRecurringTransactions } from '@/hooks/useRecurringTransactions'
import type { DetectedRecurring, Frequency, RecurringStatus } from '@/types'
import { getAvailableCategories } from '@/types'
import { useStore } from '@/store'

const FREQ_LABEL: Record<Frequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

export function RecurringTransactionsPage() {
  const { settings, isSnapshotView } = useStore()
  const [tab, setTab] = useState<RecurringStatus>('active')
  const { items, loading, create, update, remove, markPaid, detect, confirm } = useRecurringTransactions(tab)

  const categories = getAvailableCategories(settings)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(categories[0] ?? 'Other')
  const [mode, setMode] = useState<'Online' | 'Cash'>('Online')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')

  const [detectOpen, setDetectOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<DetectedRecurring[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const summary = useMemo(() => {
    const monthly = items.reduce((s, r) => s + (r.projectedMonthly ?? 0), 0)
    const yearly = items.reduce((s, r) => s + (r.projectedYearly ?? 0), 0)
    const dueSoon = items.filter((r) => (r.daysUntilDue ?? Infinity) <= 7).length
    return { monthly, yearly, dueSoon }
  }, [items])

  const openCreate = () => {
    setEditingId(null)
    setName('')
    setAmount('')
    setCategory(categories[0] ?? 'Other')
    setMode('Online')
    setFrequency('monthly')
    setStartDate('')
    setEndDate('')
    setNotes('')
    setFormOpen(true)
  }

  const openEdit = (id: string) => {
    const found = items.find((i) => i._id === id)
    if (!found) return
    setEditingId(id)
    setName(found.name)
    setAmount(String(found.amount))
    setCategory(found.category)
    setMode(found.mode)
    setFrequency(found.frequency)
    setStartDate(found.startDate.slice(0, 10))
    setEndDate(found.endDate ? found.endDate.slice(0, 10) : '')
    setNotes(found.notes ?? '')
    setFormOpen(true)
  }

  const submit = async () => {
    const amt = Number(amount)
    if (!name.trim() || !Number.isFinite(amt) || amt < 0 || !startDate) return

    const payload = {
      name: name.trim(),
      amount: amt,
      category,
      mode,
      frequency,
      startDate,
      endDate: endDate || undefined,
      notes: notes || undefined,
    }

    if (editingId) {
      await update(editingId, payload)
    } else {
      await create(payload)
    }

    setFormOpen(false)
  }

  const runDetect = async () => {
    const s = await detect()
    setSuggestions(s)
    setSelected(new Set(s.map((_, idx) => idx)))
    setDetectOpen(true)
  }

  const confirmSelected = async () => {
    const picked = suggestions.filter((_, idx) => selected.has(idx))
    if (picked.length === 0) return
    await confirm(picked)
    setDetectOpen(false)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          <h1 className="text-display text-2xl font-bold text-foreground">Recurring</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void runDetect()}
            disabled={isSnapshotView}
            className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-foreground inline-flex items-center gap-2"
          >
            <AlertCircle className="h-4 w-4" />
            Detect
          </button>
          <button
            onClick={openCreate}
            disabled={isSnapshotView}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      <div className="card-base p-5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Monthly recurring cost</div>
            <div className="text-display text-xl font-bold text-foreground">{formatCurrency(summary.monthly)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Yearly</div>
            <div className="text-display text-xl font-bold text-foreground">{formatCurrency(summary.yearly)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Due this week</div>
            <div className="text-display text-xl font-bold text-foreground">{summary.dueSoon}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        {(['active', 'paused', 'ended'] as RecurringStatus[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-xl px-3 py-2 text-xs font-semibold',
              tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {items.map((r) => {
          const due = r.daysUntilDue ?? Infinity
          const border = due < 0 ? 'border-l-red-500' : due <= 7 ? 'border-l-yellow-500' : 'border-l-transparent'
          const badge = due < 0 ? 'Overdue' : due <= 7 ? 'Due soon' : Number.isFinite(due) ? `${due} days` : '—'
          return (
            <div key={r._id} className={cn('card-base p-5 border-l-4', border)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-display text-base font-semibold text-foreground truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(r.amount)} · {r.category} · {FREQ_LABEL[r.frequency]}
                  </div>
                </div>
                <div className={cn(
                  'rounded-full px-2 py-1 text-[10px] font-semibold',
                  due < 0 ? 'bg-red-500/10 text-red-500' : due <= 7 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-secondary text-foreground',
                )}>
                  {badge}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Next</div>
                  <div className="font-semibold text-foreground">{formatDate(r.nextDueDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Last paid</div>
                  <div className="font-semibold text-foreground">{r.lastPaidDate ? formatDate(r.lastPaidDate) : '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="font-semibold text-foreground">{formatCurrency(r.totalPaid)} ({r.occurrences}x)</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Monthly</div>
                  <div className="font-semibold text-foreground">{formatCurrency(r.projectedMonthly)}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void markPaid(r._id)}
                  disabled={isSnapshotView || r.status !== 'active'}
                  className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Mark as Paid
                </button>
                <button
                  onClick={() => openEdit(r._id)}
                  disabled={isSnapshotView}
                  className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-foreground"
                >
                  Edit
                </button>
                {r.status !== 'ended' && (
                  <button
                    onClick={() => void remove(r._id)}
                    disabled={isSnapshotView}
                    className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-foreground"
                  >
                    End
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {items.length === 0 && (
          <div className="card-base p-10 text-center text-muted-foreground">
            {loading ? 'Loading…' : 'No recurring transactions yet.'}
          </div>
        )}
      </div>

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingId ? 'Edit Recurring' : 'Add Recurring'}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Amount (₹)</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Mode</label>
                <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
                  <option value="Online">Online</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Frequency</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as any)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
                {Object.keys(FREQ_LABEL).map((f) => (
                  <option key={f} value={f}>{FREQ_LABEL[f as Frequency]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Start</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">End (optional)</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes (optional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm min-h-[80px]" />
            </div>
            <button onClick={() => void submit()} disabled={isSnapshotView} className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Save
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={detectOpen} onOpenChange={setDetectOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Detected Recurring</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {suggestions.length === 0 && (
              <div className="text-sm text-muted-foreground">No strong patterns found.</div>
            )}
            {suggestions.map((s, idx) => (
              <label key={idx} className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.has(idx)}
                  onChange={(e) => {
                    const next = new Set(selected)
                    if (e.target.checked) next.add(idx)
                    else next.delete(idx)
                    setSelected(next)
                  }}
                  className="mt-1"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatCurrency(s.amount)} · {s.category} · {FREQ_LABEL[s.frequency]} · {Math.round(s.confidence * 100)}%
                  </div>
                </div>
              </label>
            ))}
            <button
              onClick={() => void confirmSelected()}
              disabled={isSnapshotView || suggestions.length === 0}
              className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Confirm Selected
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  )
}
