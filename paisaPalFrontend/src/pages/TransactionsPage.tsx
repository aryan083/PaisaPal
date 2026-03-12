import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CATEGORIES, CATEGORY_HEX, type Category } from '@/types'
import { Search, Plus, Pencil, Trash2, Upload, CheckSquare, Square, XCircle } from 'lucide-react'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import { BulkImport } from '@/components/transactions/BulkImport'
import { toast } from 'sonner'

type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

export function TransactionsPage() {
  const { transactions, removeTransaction, openForm, formOpen } = useStore()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All')
  const [sort, setSort] = useState<SortKey>('date-desc')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

  const filtered = useMemo(() => {
    let result = [...transactions]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(t =>
        t.particulars.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q)
      )
    }
    if (categoryFilter !== 'All') {
      result = result.filter(t => t.category === categoryFilter)
    }
    result.sort((a, b) => {
      switch (sort) {
        case 'date-desc': return new Date(b.date).getTime() - new Date(a.date).getTime()
        case 'date-asc': return new Date(a.date).getTime() - new Date(b.date).getTime()
        case 'amount-desc': return b.amount - a.amount
        case 'amount-asc': return a.amount - b.amount
      }
    })
    return result
  }, [transactions, search, categoryFilter, sort])

  const handleDelete = (id: string) => {
    if (deletingId === id) {
      removeTransaction(id)
      setDeletingId(null)
      toast.success('Transaction deleted')
    } else {
      setDeletingId(id)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(t => t.id)))
    }
  }

  const handleBulkDelete = () => {
    if (!bulkDeleteConfirm) {
      setBulkDeleteConfirm(true)
      return
    }
    const count = selectedIds.size
    selectedIds.forEach(id => removeTransaction(id))
    setSelectedIds(new Set())
    setBulkDeleteConfirm(false)
    toast.success(`${count} transaction${count !== 1 ? 's' : ''} deleted`)
  }

  const cancelBulkDelete = () => {
    setBulkDeleteConfirm(false)
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setBulkDeleteConfirm(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-display text-2xl font-bold text-foreground">Transactions</h1>
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => setBulkOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Upload className="h-4 w-4" /> Bulk Import
          </button>
          <button
            onClick={() => openForm()}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Add Transaction
          </button>
        </div>
      </div>

      {/* Bulk selection bar */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center gap-3 rounded-xl bg-secondary px-4 py-3"
        >
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          {bulkDeleteConfirm ? (
            <>
              <span className="text-xs text-[hsl(var(--danger))]">Delete {selectedIds.size} transaction{selectedIds.size !== 1 ? 's' : ''}?</span>
              <button
                onClick={handleBulkDelete}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground"
              >
                Confirm Delete
              </button>
              <button
                onClick={cancelBulkDelete}
                className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-[hsl(var(--danger))] hover:bg-destructive/20 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Selected
              </button>
              <button
                onClick={clearSelection}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" /> Clear
              </button>
            </>
          )}
        </motion.div>
      )}

      {/* Mobile bulk import button */}
      <div className="sm:hidden mb-3">
        <button
          onClick={() => setBulkOpen(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-foreground"
        >
          <Upload className="h-4 w-4" /> Bulk Import
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search transactions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value as Category | 'All')}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="All">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="amount-desc">Amount ↓</option>
          <option value="amount-asc">Amount ↑</option>
        </select>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block card-base overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-3 text-left">
                <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground" aria-label="Select all">
                  {selectedIds.size === filtered.length && filtered.length > 0
                    ? <CheckSquare className="h-4 w-4 text-primary" />
                    : <Square className="h-4 w-4" />
                  }
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Particulars</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Mode</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Notes</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.map(tx => (
                <motion.tr
                  key={tx.id}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`border-b border-border/50 transition-colors hover:bg-secondary/50 ${deletingId === tx.id ? 'bg-[hsl(var(--danger)/0.08)]' : ''} ${selectedIds.has(tx.id) ? 'bg-primary/5' : ''}`}
                >
                  <td className="px-3 py-3">
                    <button onClick={() => toggleSelect(tx.id)} className="text-muted-foreground hover:text-foreground" aria-label="Select">
                      {selectedIds.has(tx.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(tx.date)}</td>
                  <td className="px-4 py-3 text-foreground max-w-[200px] truncate">{tx.particulars}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ background: `${CATEGORY_HEX[tx.category]}18`, color: CATEGORY_HEX[tx.category] }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_HEX[tx.category] }} />
                      {tx.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">{formatCurrency(tx.amount)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{tx.mode}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[150px] truncate">{tx.notes || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {deletingId === tx.id ? (
                        <>
                          <button onClick={() => handleDelete(tx.id)} aria-label="Confirm delete" className="rounded-lg bg-destructive px-2 py-1 text-xs text-destructive-foreground">Confirm</button>
                          <button onClick={() => setDeletingId(null)} aria-label="Cancel delete" className="rounded-lg bg-secondary px-2 py-1 text-xs text-muted-foreground">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openForm(tx)} aria-label="Edit transaction" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(tx.id)} aria-label="Delete transaction" className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">No transactions found</div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-3">
        <AnimatePresence>
          {filtered.map(tx => (
            <motion.div
              key={tx.id}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className={`card-base p-4 ${deletingId === tx.id ? 'bg-[hsl(var(--danger)/0.08)]' : ''} ${selectedIds.has(tx.id) ? 'ring-1 ring-primary' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleSelect(tx.id)} className="text-muted-foreground" aria-label="Select">
                    {selectedIds.has(tx.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                  </button>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ background: `${CATEGORY_HEX[tx.category]}18`, color: CATEGORY_HEX[tx.category] }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_HEX[tx.category] }} />
                    {tx.category}
                  </span>
                </div>
                <span className="text-base font-bold text-foreground">{formatCurrency(tx.amount)}</span>
              </div>
              <p className="text-sm text-foreground mb-1">{tx.particulars}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(tx.date)}</span>
                  <span className="rounded-full bg-secondary px-1.5 py-0.5">{tx.mode}</span>
                </div>
                <div className="flex items-center gap-1">
                  {deletingId === tx.id ? (
                    <>
                      <button onClick={() => handleDelete(tx.id)} aria-label="Confirm" className="rounded-lg bg-destructive px-2 py-1 text-xs text-destructive-foreground">Yes</button>
                      <button onClick={() => setDeletingId(null)} aria-label="Cancel" className="rounded-lg bg-secondary px-2 py-1 text-xs text-muted-foreground">No</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => openForm(tx)} aria-label="Edit" className="p-1 text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(tx.id)} aria-label="Delete" className="p-1 text-muted-foreground"><Trash2 className="h-3.5 w-3.5" /></button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">No transactions found</div>
        )}
      </div>

      <TransactionForm />
      <BulkImport open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </motion.div>
  )
}
