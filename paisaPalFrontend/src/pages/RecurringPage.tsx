import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Repeat, Plus, Pencil, Trash2, Play, Eye, Calendar, AlertCircle, CheckCircle, Pause } from 'lucide-react'
import {
  fetchRecurringRules,
  createRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
  previewRecurringRule,
  runRecurringRules,
  type ApiRecurringRule,
  type RecurringRuleInput,
} from '@/lib/api'
import { formatCurrency, formatDate, toLocalDateKey } from '@/lib/utils'
import { getAvailableCategories, getCategoryHex, type Category, type Frequency } from '@/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatToastMessage, getUserError } from '@/lib/userError'
import { useStore } from '@/store'

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

export function RecurringPage() {
  const { settings, isSnapshotView } = useStore()
  const [rules, setRules] = useState<ApiRecurringRule[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ApiRecurringRule | null>(null)
  const [previewData, setPreviewData] = useState<{ dates: string[]; visible: boolean }>({ dates: [], visible: false })
  const [running, setRunning] = useState(false)

  const categories = getAvailableCategories(settings)

  const loadRules = async () => {
    try {
      setLoading(true)
      const data = await fetchRecurringRules()
      setRules(data)
    } catch (err) {
      const u = getUserError(err, 'Failed to load recurring rules')
      toast.error(formatToastMessage(u))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isSnapshotView) {
      setLoading(false)
      setRules([])
      return
    }
    void loadRules()
  }, [isSnapshotView])

  if (isSnapshotView) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <h1 className="text-display text-2xl font-bold text-foreground mb-4">Recurring</h1>
        <div className="card-base p-6 text-muted-foreground">
          Recurring rules are not available in snapshot view.
        </div>
      </motion.div>
    )
  }

  const handleCreate = async (input: RecurringRuleInput) => {
    try {
      await createRecurringRule(input)
      toast.success('Recurring rule created')
      setFormOpen(false)
      void loadRules()
    } catch (err) {
      const u = getUserError(err, 'Failed to create rule')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  const handleUpdate = async (id: string, input: Partial<RecurringRuleInput>) => {
    try {
      await updateRecurringRule(id, input)
      toast.success('Rule updated')
      setFormOpen(false)
      setEditingRule(null)
      void loadRules()
    } catch (err) {
      const u = getUserError(err, 'Failed to update rule')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteRecurringRule(id)
      toast.success('Rule deleted')
      void loadRules()
    } catch (err) {
      const u = getUserError(err, 'Failed to delete rule')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  const handlePreview = async (rule: RecurringRuleInput) => {
    try {
      const result = await previewRecurringRule(rule, 5)
      setPreviewData({ dates: result.nextOccurrences, visible: true })
    } catch (err) {
      const u = getUserError(err, 'Failed to preview')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  const handleRun = async (dryRun: boolean) => {
    try {
      setRunning(true)
      const result = await runRecurringRules(dryRun)
      if (dryRun) {
        toast.info(`Dry run: ${result.created} transactions would be created`)
      } else {
        toast.success(`Created ${result.created} transactions`)
        void loadRules()
      }
    } catch (err) {
      const u = getUserError(err, 'Failed to run rules')
      toast.error(formatToastMessage(u))
      console.error(err)
    } finally {
      setRunning(false)
    }
  }

  const openEdit = (rule: ApiRecurringRule) => {
    setEditingRule(rule)
    setFormOpen(true)
  }

  const openCreate = () => {
    setEditingRule(null)
    setFormOpen(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-display text-2xl font-bold text-foreground">Recurring Rules</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleRun(true)}
            disabled={running}
            className="hidden sm:flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Eye className="h-4 w-4" /> Preview Run
          </button>
          <button
            onClick={() => handleRun(false)}
            disabled={running}
            className="hidden sm:flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Play className="h-4 w-4" /> Run Now
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Add Rule
          </button>
        </div>
      </div>

      {/* Mobile action buttons */}
      <div className="sm:hidden flex gap-2 mb-4">
        <button
          onClick={() => handleRun(true)}
          disabled={running}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
        >
          <Eye className="h-4 w-4" /> Preview
        </button>
        <button
          onClick={() => handleRun(false)}
          disabled={running}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
        >
          <Play className="h-4 w-4" /> Run
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : rules.length === 0 ? (
        <div className="card-base p-12 text-center">
          <Repeat className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No recurring rules yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Create a rule to automatically generate transactions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <motion.div
              key={rule._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`card-base p-4 ${!rule.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {rule.isActive ? (
                      <CheckCircle className="h-4 w-4 text-[hsl(var(--success))]" />
                    ) : (
                      <Pause className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-semibold text-foreground">{rule.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {FREQUENCY_LABELS[rule.frequency]}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{rule.particulars}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatCurrency(rule.amount)}</span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                      style={{
                        background: `${getCategoryHex(rule.category, settings)}18`,
                        color: getCategoryHex(rule.category, settings),
                      }}
                    >
                      {rule.category}
                    </span>
                    <span>{rule.mode}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Next: {formatDate(rule.nextDue)}
                    </span>
                    {rule.endDate && (
                      <span>Until: {formatDate(rule.endDate)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(rule)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    aria-label="Edit rule"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule._id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    aria-label="Delete rule"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Rule Form Sheet */}
      <RuleFormSheet
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingRule(null) }}
        rule={editingRule}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onPreview={handlePreview}
        categories={categories}
      />

      {/* Preview Modal */}
      {previewData.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPreviewData({ ...previewData, visible: false })}>
          <div className="bg-card rounded-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-4">Next Occurrences</h3>
            <div className="space-y-2">
              {previewData.dates.map((date, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDate(date)}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setPreviewData({ ...previewData, visible: false })}
              className="mt-4 w-full rounded-xl bg-primary py-2 text-sm font-medium text-primary-foreground"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

interface RuleFormSheetProps {
  open: boolean
  onClose: () => void
  rule: ApiRecurringRule | null
  onCreate: (input: RecurringRuleInput) => void
  onUpdate: (id: string, input: Partial<RecurringRuleInput>) => void
  onPreview: (input: RecurringRuleInput) => void
  categories: string[]
}

function RuleFormSheet({ open, onClose, rule, onCreate, onUpdate, onPreview, categories }: RuleFormSheetProps) {
  const [name, setName] = useState('')
  const [particulars, setParticulars] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Category>('Other')
  const [mode, setMode] = useState<'Online' | 'Cash' | 'Card'>('Online')
  const [notes, setNotes] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [dayOfWeek, setDayOfWeek] = useState('0')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (rule) {
      setName(rule.name)
      setParticulars(rule.particulars)
      setAmount(String(rule.amount))
      setCategory(rule.category as Category)
      setMode(rule.mode)
      setNotes(rule.notes || '')
      setFrequency(rule.frequency)
      setDayOfMonth(String(rule.dayOfMonth || 1))
      setDayOfWeek(String(rule.dayOfWeek || 0))
      setStartDate(rule.startDate.split('T')[0])
      setEndDate(rule.endDate?.split('T')[0] || '')
      setIsActive(rule.isActive)
    } else {
      setName('')
      setParticulars('')
      setAmount('')
      setCategory('Other')
      setMode('Online')
      setNotes('')
      setFrequency('monthly')
      setDayOfMonth('1')
      setDayOfWeek('0')
      setStartDate(toLocalDateKey(new Date()))
      setEndDate('')
      setIsActive(true)
    }
  }, [rule, open])

  const handleSubmit = () => {
    if (!name || !particulars || !amount || !startDate) {
      toast.error('Please fill all required fields')
      return
    }

    const input: RecurringRuleInput = {
      name,
      particulars,
      amount: parseFloat(amount),
      category,
      mode,
      notes: notes || undefined,
      frequency,
      dayOfMonth: frequency === 'monthly' || frequency === 'yearly' ? parseInt(dayOfMonth) : undefined,
      dayOfWeek: frequency === 'weekly' ? parseInt(dayOfWeek) : undefined,
      startDate,
      endDate: endDate || undefined,
      isActive,
    }

    if (rule) {
      onUpdate(rule._id, input)
    } else {
      onCreate(input)
    }
  }

  const handlePreview = () => {
    if (!name || !particulars || !amount || !startDate) {
      toast.error('Please fill all required fields')
      return
    }

    onPreview({
      name,
      particulars,
      amount: parseFloat(amount),
      category,
      mode,
      notes: notes || undefined,
      frequency,
      dayOfMonth: frequency === 'monthly' || frequency === 'yearly' ? parseInt(dayOfMonth) : undefined,
      dayOfWeek: frequency === 'weekly' ? parseInt(dayOfWeek) : undefined,
      startDate,
      endDate: endDate || undefined,
      isActive,
    })
  }

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-lg bg-card border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-display text-foreground">
            {rule ? 'Edit Rule' : 'New Recurring Rule'}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Monthly Rent"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Description *</label>
            <input
              value={particulars}
              onChange={e => setParticulars(e.target.value)}
              placeholder="Transaction description"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Amount *</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Mode</label>
              <select
                value={mode}
                onChange={e => setMode(e.target.value as 'Online' | 'Cash' | 'Card')}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="Online">Online</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Frequency</label>
            <select
              value={frequency}
              onChange={e => setFrequency(e.target.value as Frequency)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {(frequency === 'monthly' || frequency === 'yearly') && (
            <div>
              <label className="text-sm text-muted-foreground">Day of Month</label>
              <input
                type="number"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={e => setDayOfMonth(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          )}

          {frequency === 'weekly' && (
            <div>
              <label className="text-sm text-muted-foreground">Day of Week</label>
              <select
                value={dayOfWeek}
                onChange={e => setDayOfWeek(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Notes</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <label htmlFor="isActive" className="text-sm text-muted-foreground">Active</label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handlePreview}
              className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-medium text-foreground"
            >
              Preview
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              {rule ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
