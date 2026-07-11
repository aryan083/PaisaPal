import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Wallet, Plus, Pencil, Trash2, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react'
import {
  fetchBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  fetchBudgetStats,
  type ApiBudget,
  type BudgetInput,
  type BudgetStatsData,
} from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { getAvailableCategories, getCategoryHex, type Category } from '@/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatToastMessage, getUserError } from '@/lib/userError'
import { useStore } from '@/store'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function BudgetsPage() {
  const { settings, transactions, isSnapshotView, snapshotBudgets } = useStore()
  const [budgets, setBudgets] = useState<ApiBudget[]>([])
  const [stats, setStats] = useState<BudgetStatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(getCurrentMonth())
  const [formOpen, setFormOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<ApiBudget | null>(null)

  const categories = getAvailableCategories(settings)

  const loadData = async () => {
    try {
      setLoading(true)
      if (isSnapshotView) {
        const budgetData = snapshotBudgets.filter(b => b.month === month)
        const txsForMonth = transactions.filter(t => (t.dateKey || t.date).slice(0, 7) === month)

        const spentMap = new Map<string, number>()
        txsForMonth.forEach(t => {
          spentMap.set(t.category, (spentMap.get(t.category) || 0) + t.amount)
        })

        const budgetStats = budgetData.map(b => {
          const spent = spentMap.get(b.category) || 0
          const remaining = b.monthlyLimit - spent
          const percentage = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0
          return {
            category: b.category,
            monthlyLimit: b.monthlyLimit,
            spent,
            remaining,
            percentage,
            isOverBudget: remaining < 0,
          }
        })

        const totalBudgeted = budgetStats.reduce((s, b) => s + b.monthlyLimit, 0)
        const totalSpent = budgetStats.reduce((s, b) => s + b.spent, 0)

        setBudgets(budgetData)
        setStats({ month, budgets: budgetStats, totalBudgeted, totalSpent })
        return
      }

      const [budgetData, statsData] = await Promise.all([
        fetchBudgets(month),
        fetchBudgetStats(month),
      ])
      setBudgets(budgetData)
      setStats(statsData)
    } catch (err) {
      const u = getUserError(err, 'Failed to load budgets')
      toast.error(formatToastMessage(u))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [month, isSnapshotView])

  const handleCreate = async (input: BudgetInput) => {
    if (isSnapshotView) return
    try {
      await createBudget(input)
      toast.success('Budget created')
      setFormOpen(false)
      void loadData()
    } catch (err) {
      const u = getUserError(err, 'Failed to create budget')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  const handleUpdate = async (id: string, monthlyLimit: number) => {
    if (isSnapshotView) return
    try {
      await updateBudget(id, { monthlyLimit })
      toast.success('Budget updated')
      setFormOpen(false)
      setEditingBudget(null)
      void loadData()
    } catch (err) {
      const u = getUserError(err, 'Failed to update budget')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    if (isSnapshotView) return
    try {
      await deleteBudget(id)
      toast.success('Budget deleted')
      void loadData()
    } catch (err) {
      const u = getUserError(err, 'Failed to delete budget')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  const openEdit = (budget: ApiBudget) => {
    setEditingBudget(budget)
    setFormOpen(true)
  }

  const openCreate = () => {
    setEditingBudget(null)
    setFormOpen(true)
  }

  const monthLabel = (() => {
    const [y, m] = month.split('-')
    const date = new Date(parseInt(y), parseInt(m) - 1)
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  })()

  const prevMonth = () => {
    const [y, m] = month.split('-').map(Number)
    const date = new Date(y, m - 2)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  const nextMonth = () => {
    const [y, m] = month.split('-').map(Number)
    const date = new Date(y, m)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-display text-2xl font-bold text-foreground">Budgets</h1>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-medium text-foreground min-w-[140px] text-center">{monthLabel}</span>
            <button onClick={nextMonth} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          disabled={isSnapshotView}
        >
          <Plus className="h-4 w-4" /> Add Budget
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="card-base p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Budgeted</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(stats.totalBudgeted)}</p>
              </div>
              <div className="card-base p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(stats.totalSpent)}</p>
              </div>
              <div className="card-base p-4">
                <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                <p className={`text-xl font-bold ${stats.totalBudgeted - stats.totalSpent >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]'}`}>
                  {formatCurrency(stats.totalBudgeted - stats.totalSpent)}
                </p>
              </div>
              <div className="card-base p-4">
                <p className="text-xs text-muted-foreground mb-1">Over Budget</p>
                <p className="text-xl font-bold text-foreground">
                  {stats.budgets.filter(b => b.isOverBudget).length} categories
                </p>
              </div>
            </div>
          )}

          {/* Budget Cards */}
          {stats && stats.budgets.length > 0 ? (
            <div className="space-y-3">
              {stats.budgets.map(stat => {
                const budget = budgets.find(b => b.category === stat.category)
                const progress = Math.min(stat.percentage, 100)
                const isOver = stat.isOverBudget

                return (
                  <motion.div
                    key={stat.category}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`card-base p-4 ${isOver ? 'border-[hsl(var(--danger)/0.4)]' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        {isOver ? (
                          <AlertTriangle className="h-4 w-4 text-[hsl(var(--danger))]" />
                        ) : (
                          <Wallet className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span
                          className="font-semibold"
                          style={{ color: getCategoryHex(stat.category, settings) }}
                        >
                          {stat.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => budget && openEdit(budget)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                          aria-label="Edit budget"
                          disabled={isSnapshotView}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {budget && (
                          <button
                            onClick={() => handleDelete(budget._id)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            aria-label="Delete budget"
                            disabled={isSnapshotView}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 rounded-full bg-secondary overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all ${isOver ? 'bg-[hsl(var(--danger))]' : 'bg-primary'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">
                          Spent: <span className="font-semibold text-foreground">{formatCurrency(stat.spent)}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Budget: <span className="font-semibold text-foreground">{formatCurrency(stat.monthlyLimit)}</span>
                        </span>
                      </div>
                      <span className={`font-semibold ${isOver ? 'text-[hsl(var(--danger))]' : stat.remaining > 0 ? 'text-[hsl(var(--success))]' : 'text-muted-foreground'}`}>
                        {isOver ? (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {formatCurrency(Math.abs(stat.remaining))} over
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" />
                            {formatCurrency(stat.remaining)} left
                          </span>
                        )}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <div className="card-base p-12 text-center">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No budgets set for {monthLabel}</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Create a budget to track your spending limits</p>
            </div>
          )}
        </>
      )}

      {/* Budget Form Sheet */}
      {!isSnapshotView && (
        <BudgetFormSheet
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingBudget(null) }}
          budget={editingBudget}
          month={month}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          existingCategories={budgets.map(b => b.category)}
          categories={categories}
        />
      )}
    </motion.div>
  )
}

interface BudgetFormSheetProps {
  open: boolean
  onClose: () => void
  budget: ApiBudget | null
  month: string
  onCreate: (input: BudgetInput) => void
  onUpdate: (id: string, monthlyLimit: number) => void
  existingCategories: string[]
  categories: string[]
}

function BudgetFormSheet({
  open,
  onClose,
  budget,
  month,
  onCreate,
  onUpdate,
  existingCategories,
  categories,
}: BudgetFormSheetProps) {
  const [category, setCategory] = useState<Category>('Other')
  const [monthlyLimit, setMonthlyLimit] = useState('')

  useEffect(() => {
    if (budget) {
      setCategory(budget.category as Category)
      setMonthlyLimit(String(budget.monthlyLimit))
    } else {
      setCategory('Other')
      setMonthlyLimit('')
    }
  }, [budget, open])

  const availableCategories = budget
    ? categories
    : categories.filter(c => !existingCategories.includes(c))

  const handleSubmit = () => {
    if (!monthlyLimit || parseFloat(monthlyLimit) <= 0) {
      toast.error('Please enter a valid budget amount')
      return
    }

    if (budget) {
      onUpdate(budget._id, parseFloat(monthlyLimit))
    } else {
      onCreate({
        category,
        monthlyLimit: parseFloat(monthlyLimit),
        month,
      })
    }
  }

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-card border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-display text-foreground">
            {budget ? 'Edit Budget' : 'New Budget'}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {!budget && (
            <div>
              <label className="text-sm text-muted-foreground">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as Category)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {availableCategories.length === 0 && (
                <p className="text-xs text-[hsl(var(--warning))] mt-1">All categories have budgets</p>
              )}
            </div>
          )}

          <div>
            <label className="text-sm text-muted-foreground">Monthly Limit (₹)</label>
            <input
              type="number"
              value={monthlyLimit}
              onChange={e => setMonthlyLimit(e.target.value)}
              placeholder="5000"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!budget && availableCategories.length === 0}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {budget ? 'Update Budget' : 'Create Budget'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
