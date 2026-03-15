import { motion } from 'framer-motion'
import { useStore } from '@/store'
import { useState } from 'react'
import { Sun, Moon, Download, Copy, PiggyBank } from 'lucide-react'
import { DEFAULT_CATEGORIES, getAvailableCategories, getCategoryHex } from '@/types'
import { encodeSnapshot, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { formatToastMessage, getUserError } from '@/lib/userError'
import { fetchAllTransactions, fetchBudgets } from '@/lib/api'
import { useSyncStore } from '@/stores/syncStore'
import { useSavingsGoals } from '@/hooks/useSavingsGoals'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function SettingsPage() {
  const {
    settings,
    updateSettings,
    remapCategory,
    theme,
    setTheme,
    transactions,
    isSnapshotView,
  } = useStore()
  const { goals } = useSavingsGoals()
  const [stipend, setStipend] = useState(String(settings.stipend))
  const [extra, setExtra] = useState(String(settings.extra))

  const [rapidoTaxEnabled, setRapidoTaxEnabled] = useState(Boolean(settings.rapidoTaxEnabled))
  const [rapidoTaxPercent, setRapidoTaxPercent] = useState(String(settings.rapidoTaxPercent ?? 10))
  const [primarySavingsGoalId, setPrimarySavingsGoalId] = useState(settings.primarySavingsGoalId ?? '')
  const [monthEndReminderEnabled, setMonthEndReminderEnabled] = useState(
    Boolean(settings.monthEndReminderEnabled),
  )
  const [envelopeWarningThreshold, setEnvelopeWarningThreshold] = useState(
    String(settings.envelopeWarningThreshold ?? 80),
  )

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#6080a0')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteRemapTo, setDeleteRemapTo] = useState('')

  const handleSave = async () => {
    if (isSnapshotView) return
    try {
      await updateSettings({
        stipend: parseInt(stipend) || 0,
        extra: parseInt(extra) || 0,
        rapidoTaxEnabled,
        rapidoTaxPercent: Math.min(25, Math.max(5, parseInt(rapidoTaxPercent) || 10)),
        primarySavingsGoalId: primarySavingsGoalId || undefined,
        monthEndReminderEnabled,
        envelopeWarningThreshold: Math.min(95, Math.max(50, parseInt(envelopeWarningThreshold) || 80)),
      })
      toast.success('Settings saved')
    } catch (err) {
      const u = getUserError(err, 'Failed to save settings')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  const exportCSV = () => {
    const header = 'Date,Particulars,Amount,Category,Mode,Notes'
    const rows = transactions.map(t =>
      `${t.date},"${t.particulars}",${t.amount},${t.category},${t.mode},"${t.notes}"`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'paisa-tracker-export.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  const shareSnapshot = async () => {
    try {
      const online = useSyncStore.getState().isOnline
      let snapshotTransactions = transactions
      let snapshotBudgets: any[] = []

      if (online) {
        const [apiTxs, apiBudgets] = await Promise.all([
          fetchAllTransactions(),
          fetchBudgets(),
        ])
        snapshotTransactions = apiTxs.map((tx) => ({
          id: tx._id,
          date: tx.date,
          dateKey: tx.dateKey,
          particulars: tx.particulars,
          amount: tx.amount,
          category: (tx.category || 'Other') as any,
          mode: tx.mode as any,
          notes: tx.notes,
          createdAt: tx.createdAt,
          updatedAt: tx.updatedAt,
        }))

        snapshotBudgets = apiBudgets
      }

      const data = { transactions: snapshotTransactions, settings, budgets: snapshotBudgets }
      const encoded = encodeSnapshot(data)
      const url = `${window.location.origin}${window.location.pathname}?snapshot=${encoded}`
      try {
        await navigator.clipboard.writeText(url)
        toast.success('Snapshot URL copied to clipboard')
        return
      } catch {
        const el = document.createElement('textarea')
        el.value = url
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        toast.success('Snapshot URL copied to clipboard')
      }
    } catch (err) {
      const u = getUserError(err, 'Failed to share snapshot')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  // Get per-category totals for reference grid
  const catTotals = new Map<string, number>()
  transactions.forEach(t => catTotals.set(t.category, (catTotals.get(t.category) || 0) + t.amount))

  const categories = getAvailableCategories(settings)

  const isCustomCategory = (name: string) => !DEFAULT_CATEGORIES.includes(name as never)

  const setCategoryColor = async (name: string, color: string) => {
    if (isSnapshotView) return
    const next = [...(settings.categoryConfig ?? [])]
    const existingIdx = next.findIndex(c => c.name === name)
    if (existingIdx >= 0) {
      next[existingIdx] = { name, color }
    } else {
      next.push({ name, color })
    }

    try {
      await updateSettings({ categoryConfig: next })
      toast.success('Category updated')
    } catch (err) {
      const u = getUserError(err, 'Failed to update category')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  const addCategory = async () => {
    if (isSnapshotView) return
    const name = newCategoryName.trim()
    if (!name) {
      toast.error('Category name is required')
      return
    }
    if (name.length > 50) {
      toast.error('Category name must be <= 50 characters')
      return
    }
    if (categories.includes(name)) {
      toast.error('Category already exists')
      return
    }

    const next = [...(settings.categoryConfig ?? []), { name, color: newCategoryColor }]
    try {
      await updateSettings({ categoryConfig: next })
      setNewCategoryName('')
      toast.success('Category added')
    } catch (err) {
      const u = getUserError(err, 'Failed to add category')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  const openDeleteDialog = (name: string) => {
    if (isSnapshotView) return
    setDeleteTarget(name)
    const fallback = categories.find(c => c !== name) ?? 'Other'
    setDeleteRemapTo(fallback)
  }

  const confirmDelete = async () => {
    if (isSnapshotView) return
    if (!deleteTarget) return
    const fromCategory = deleteTarget
    const toCategory = deleteRemapTo
    if (!toCategory || toCategory === fromCategory) {
      toast.error('Please select a different category to remap into')
      return
    }

    try {
      await remapCategory(fromCategory, toCategory)
      const next = (settings.categoryConfig ?? []).filter(c => c.name !== fromCategory)
      await updateSettings({ categoryConfig: next })
      toast.success(`Remapped "${fromCategory}" to "${toCategory}" and deleted category`)
      setDeleteTarget(null)
    } catch (err) {
      const u = getUserError(err, 'Failed to delete category')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="max-w-2xl"
    >
      <h1 className="text-display text-2xl font-bold text-foreground mb-6">Settings</h1>

      {/* Budget */}
      <section className="card-base p-5 mb-4">
        <h2 className="text-display text-base font-semibold text-foreground mb-4">Budget</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label htmlFor="stipend" className="text-xs text-muted-foreground mb-1 block">Monthly Stipend (₹)</label>
            <input
              id="stipend"
              type="number"
              value={stipend}
              onChange={e => setStipend(e.target.value)}
              disabled={isSnapshotView}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label htmlFor="extra" className="text-xs text-muted-foreground mb-1 block">Extra Income (₹)</label>
            <input
              id="extra"
              type="number"
              value={extra}
              onChange={e => setExtra(e.target.value)}
              disabled={isSnapshotView}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSnapshotView}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Save
        </button>
      </section>

      {/* Savings Preferences */}
      <section className="card-base p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <PiggyBank className="h-4 w-4 text-primary" />
          <h2 className="text-display text-base font-semibold text-foreground">Savings Preferences</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">Rapido Tax</div>
              <div className="text-xs text-muted-foreground">Auto-save a % of every Rapido transaction</div>
            </div>
            <button
              onClick={() => setRapidoTaxEnabled(!rapidoTaxEnabled)}
              disabled={isSnapshotView}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                rapidoTaxEnabled ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
              )}
            >
              {rapidoTaxEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Rapido Tax % (5–25)</label>
              <input
                type="number"
                value={rapidoTaxPercent}
                onChange={(e) => setRapidoTaxPercent(e.target.value)}
                disabled={isSnapshotView || !rapidoTaxEnabled}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Envelope warning % (50–95)</label>
              <input
                type="number"
                value={envelopeWarningThreshold}
                onChange={(e) => setEnvelopeWarningThreshold(e.target.value)}
                disabled={isSnapshotView}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Primary savings goal</label>
            <select
              value={primarySavingsGoalId}
              onChange={(e) => setPrimarySavingsGoalId(e.target.value)}
              disabled={isSnapshotView}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Auto-pick first active goal</option>
              {goals
                .filter((g) => g.status === 'active')
                .map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.emoji} {g.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">Month-end reminder</div>
              <div className="text-xs text-muted-foreground">Remind you to handle envelope surplus</div>
            </div>
            <button
              onClick={() => setMonthEndReminderEnabled(!monthEndReminderEnabled)}
              disabled={isSnapshotView}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                monthEndReminderEnabled ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
              )}
            >
              {monthEndReminderEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={isSnapshotView}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Save preferences
          </button>
        </div>
      </section>

      {/* Appearance */}
      <section className="card-base p-5 mb-4">
        <h2 className="text-display text-base font-semibold text-foreground mb-4">Appearance</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">Theme</span>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
            className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm text-foreground transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </section>

      {/* Data */}
      <section className="card-base p-5 mb-4">
        <h2 className="text-display text-base font-semibold text-foreground mb-4">Data</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={shareSnapshot} className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
            <Copy className="h-4 w-4" /> Share Snapshot
          </button>
        </div>
      </section>

      {/* Categories */}
      <section className="card-base p-5">
        <h2 className="text-display text-base font-semibold text-foreground mb-4">Categories</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {categories.map(cat => {
            const custom = isCustomCategory(cat)
            return (
              <div key={cat} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2">
                <div className="flex items-center gap-2">
                  <input
                    aria-label={`Color for ${cat}`}
                    type="color"
                    value={getCategoryHex(cat, settings)}
                    onChange={e => void setCategoryColor(cat, e.target.value)}
                    disabled={isSnapshotView}
                    className="h-6 w-6 rounded border border-border bg-transparent p-0"
                  />
                  <span className="text-sm text-foreground">{cat}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    {formatCurrency(catTotals.get(cat) || 0)}
                  </span>

                  {custom && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          onClick={() => openDeleteDialog(cat)}
                          className="text-xs text-[hsl(var(--danger))] hover:underline"
                          disabled={isSnapshotView}
                        >
                          Delete
                        </button>
                      </AlertDialogTrigger>

                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete category</AlertDialogTitle>
                          <AlertDialogDescription>
                            This category is deleted only after remapping all existing data to another category.
                          </AlertDialogDescription>
                        </AlertDialogHeader>

                        <div className="space-y-2">
                          <div className="text-sm text-foreground">
                            <span className="font-medium">From:</span> {deleteTarget ?? cat}
                          </div>

                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">
                              Remap to
                            </label>
                            <select
                              value={deleteRemapTo}
                              onChange={e => setDeleteRemapTo(e.target.value)}
                              disabled={isSnapshotView}
                              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                            >
                              {categories
                                .filter(c => c !== (deleteTarget ?? cat))
                                .map(c => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => void confirmDelete()}
                            className="bg-[hsl(var(--danger))] text-[hsl(var(--destructive-foreground))]"
                            disabled={isSnapshotView}
                          >
                            Remap & Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="rounded-xl border border-border p-3">
          <h3 className="text-sm font-medium text-foreground mb-2">Add new category</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              disabled={isSnapshotView}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <input
              aria-label="New category color"
              type="color"
              value={newCategoryColor}
              onChange={e => setNewCategoryColor(e.target.value)}
              disabled={isSnapshotView}
              className="h-10 w-full sm:w-12 rounded-xl border border-border bg-transparent p-1"
            />
            <button
              onClick={() => void addCategory()}
              disabled={isSnapshotView}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Add
            </button>
          </div>
        </div>
      </section>
    </motion.div>
  )
}
