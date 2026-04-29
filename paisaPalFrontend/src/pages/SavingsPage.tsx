import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { PiggyBank, Plus, History, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatCurrency } from '@/lib/utils'
import { useSavingsGoals } from '@/hooks/useSavingsGoals'
import { useSavingsStats } from '@/hooks/useSavingsStats'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const PRESET_COLORS = ['#22d47a', '#4da6ff', '#ff4f6a', '#b06aff', '#ffaa2b', '#6080a0']

export function SavingsPage() {
  const { goals, loading, create, contribute, history, remove } = useSavingsGoals()
  const { stats } = useSavingsStats()

  const [createOpen, setCreateOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState<{ open: boolean; goalId: string | null }>({
    open: false,
    goalId: null,
  })

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🎯')
  const [targetAmount, setTargetAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0] ?? '#22d47a')

  const [contributeOpen, setContributeOpen] = useState<{ open: boolean; goalId: string | null }>({
    open: false,
    goalId: null,
  })
  const [contribAmount, setContribAmount] = useState('')
  const [contribType, setContribType] = useState<'manual' | 'surplus' | 'auto'>('manual')
  const [contribNote, setContribNote] = useState('')

  const selectedGoal = useMemo(
    () => goals.find((g) => g._id === contributeOpen.goalId) ?? null,
    [contributeOpen.goalId, goals],
  )

  const selectedHistoryGoal = useMemo(
    () => goals.find((g) => g._id === historyOpen.goalId) ?? null,
    [goals, historyOpen.goalId],
  )

  const [historyItems, setHistoryItems] = useState<Array<{ id: string; label: string }>>([])

  const [deleteOpen, setDeleteOpen] = useState<{ open: boolean; goalId: string | null }>({
    open: false,
    goalId: null,
  })

  const openHistory = async (goalId: string) => {
    setHistoryOpen({ open: true, goalId })
    const items = await history(goalId)
    setHistoryItems(
      items.map((i) => ({
        id: i._id,
        label: `${new Date(i.createdAt).toLocaleDateString()} · ${formatCurrency(i.amount)} · ${i.type}`,
      })),
    )
  }

  const submitCreate = async () => {
    const amt = Number(targetAmount)
    if (!name.trim() || !Number.isFinite(amt) || amt <= 0) return
    await create({ name: name.trim(), emoji, targetAmount: amt, deadline: deadline || undefined, color })
    setCreateOpen(false)
    setName('')
    setEmoji('🎯')
    setTargetAmount('')
    setDeadline('')
    setColor(PRESET_COLORS[0] ?? '#22d47a')
  }

  const submitContribute = async () => {
    if (!selectedGoal) return
    const amt = Number(contribAmount)
    if (!Number.isFinite(amt) || amt <= 0) return
    await contribute(selectedGoal._id, {
      amount: amt,
      type: contribType === 'auto' ? 'auto' : contribType,
      note: contribNote || undefined,
    })
    setContributeOpen({ open: false, goalId: null })
    setContribAmount('')
    setContribNote('')
    setContribType('manual')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-primary" />
          <h1 className="text-display text-2xl font-bold text-foreground">Savings</h1>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          New Goal
        </button>
      </div>

      <div className="card-base p-5 mb-4">
        <div className="text-xs text-muted-foreground">Total saved</div>
        <div className="text-display text-3xl font-bold text-foreground mt-1">
          {formatCurrency(stats?.totalSaved ?? 0)}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          Savings rate: <span className="text-foreground font-medium">{stats?.savingsRate ?? 0}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {goals.map((g) => {
          const remaining = Math.max(0, g.targetAmount - g.savedAmount)
          return (
            <div key={g._id} className="card-base p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{g.emoji}</span>
                    <div className="text-display text-base font-semibold text-foreground truncate">{g.name}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(g.savedAmount)} saved of {formatCurrency(g.targetAmount)}
                    <span className="mx-2">·</span>
                    {g.progressPercent}%
                  </div>
                </div>
                <div className={cn(
                  'rounded-full px-2 py-1 text-[10px] font-semibold',
                  g.status === 'completed'
                    ? 'bg-green-500/10 text-green-500'
                    : g.status === 'paused'
                      ? 'bg-yellow-500/10 text-yellow-500'
                      : 'bg-primary/10 text-primary',
                )}>
                  {g.status}
                </div>
              </div>

              <div className="mt-3 h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, g.progressPercent)}%`, background: g.color }}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Monthly needed</div>
                  <div className="font-semibold text-foreground">{formatCurrency(g.monthlyNeeded ?? g.monthlyTarget)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Remaining</div>
                  <div className="font-semibold text-foreground">{formatCurrency(remaining)}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => setContributeOpen({ open: true, goalId: g._id })}
                  className="flex-1 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  Add Money
                </button>
                <button
                  onClick={() => void openHistory(g._id)}
                  className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-foreground inline-flex items-center gap-2"
                >
                  <History className="h-4 w-4" />
                  History
                </button>
                <button
                  onClick={() => setDeleteOpen({ open: true, goalId: g._id })}
                  className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 inline-flex items-center gap-2"
                  aria-label="Delete goal"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}

        {goals.length === 0 && (
          <div className="card-base p-8 text-center text-muted-foreground md:col-span-2 lg:col-span-3">
            {loading ? 'Loading…' : 'No savings goals yet. Create one to start tracking.'}
          </div>
        )}
      </div>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Create Goal</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Emoji</label>
                <input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Target (₹)</label>
                <input
                  type="number"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Deadline (optional)</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Color</label>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      'h-8 w-8 rounded-full border',
                      color === c ? 'border-foreground' : 'border-border',
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={() => void submitCreate()}
              className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Create
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={contributeOpen.open} onOpenChange={(v) => setContributeOpen({ open: v, goalId: v ? contributeOpen.goalId : null })}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add Money</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="text-sm text-muted-foreground">
              Goal: <span className="text-foreground font-medium">{selectedGoal?.name ?? '-'}</span>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Amount (₹)</label>
              <input
                type="number"
                value={contribAmount}
                onChange={(e) => setContribAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select
                value={contribType}
                onChange={(e) => setContribType(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="manual">Manual</option>
                <option value="surplus">Surplus</option>
                <option value="auto">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Note (optional)</label>
              <input
                value={contribNote}
                onChange={(e) => setContribNote(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={() => void submitContribute()}
              className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Add
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={historyOpen.open} onOpenChange={(v) => setHistoryOpen({ open: v, goalId: v ? historyOpen.goalId : null })}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Goal History</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            <div className="text-sm text-muted-foreground">
              Goal: <span className="text-foreground font-medium">{selectedHistoryGoal?.name ?? '-'}</span>
            </div>
            {historyItems.length === 0 && (
              <div className="text-sm text-muted-foreground">No contributions yet.</div>
            )}
            {historyItems.map((h) => (
              <div key={h.id} className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground">
                {h.label}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen.open} onOpenChange={(v) => setDeleteOpen({ open: v, goalId: v ? deleteOpen.goalId : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Savings Goal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this goal and all its contribution history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteOpen({ open: false, goalId: null })}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteOpen.goalId) {
                  void remove(deleteOpen.goalId)
                }
                setDeleteOpen({ open: false, goalId: null })
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
