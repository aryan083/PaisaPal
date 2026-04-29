import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store'
import { formatCurrency, formatDate, getWeekdayShort } from '@/lib/utils'
import { getAvailableCategories, getCategoryHex, type Category, type PaymentMode } from '@/types'
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Plus, Pencil, Trash2, Upload, CheckSquare, Square, XCircle, Download, Filter, X } from 'lucide-react'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import { BulkImport } from '@/components/transactions/BulkImport'
import { exportTransactionsCsv, fetchTransactionsPaginated } from '@/lib/api'
import { toast } from 'sonner'
import { formatToastMessage, getUserError } from '@/lib/userError'
import { useSyncStore } from '@/stores/syncStore'

type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'particulars-asc' | 'particulars-desc' | 'category-asc' | 'category-desc' | 'mode-asc' | 'mode-desc'

export function TransactionsPage() {
  const {
    settings,
    transactions,
    transactionRevision,
    removeTransaction,
    bulkRemoveTransactions,
    openForm,
    formOpen,
    isSnapshotView,
  } = useStore()
  const isOnline = useSyncStore(s => s.isOnline)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All')
  const [sort, setSort] = useState<SortKey>('date-desc')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [modeFilter, setModeFilter] = useState<PaymentMode | 'All'>('All')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [hasNotes, setHasNotes] = useState<'All' | 'yes' | 'no'>('All')
  const [isFetching, setIsFetching] = useState(false)

  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageTransactions, setPageTransactions] = useState<typeof transactions>([])
  const limit = 50

  // Debounce search input 350ms
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = (val: string) => {
    setSearchInput(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(val)
      setPage(1)
    }, 350)
  }

  const serverSort = useMemo(() => {
    const [field, dir] = sort.split('-') as [string, string]
    const validFields = ['date', 'amount', 'particulars', 'category', 'mode']
    const sortField = validFields.includes(field) ? field : 'date'
    return { sort: sortField, order: (dir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc' }
  }, [sort])

  const cycleSort = useCallback((field: string) => {
    setSort(prev => {
      const [f, d] = prev.split('-')
      if (f === field) return `${field}-${d === 'desc' ? 'asc' : 'desc'}` as SortKey
      return `${field}-desc` as SortKey
    })
    setPage(1)
  }, [])

  const effectiveOnline = isOnline && !isSnapshotView

  // Single effect — fires on any filter/page/sort change; uses AbortController to cancel stale requests
  useEffect(() => {
    if (!effectiveOnline) return
    const controller = new AbortController()
    setIsFetching(true)
    fetchTransactionsPaginated({
      search: search || undefined,
      category: categoryFilter !== 'All' ? categoryFilter : undefined,
      mode: modeFilter !== 'All' ? modeFilter : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      minAmount: minAmount ? parseFloat(minAmount) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
      hasNotes: hasNotes !== 'All' ? hasNotes === 'yes' : undefined,
      ...serverSort,
      page,
      limit,
    }).then(res => {
      if (controller.signal.aborted) return
      setPageTransactions(res.transactions.map(tx => ({
        id: tx._id,
        date: tx.date,
        dateKey: tx.dateKey,
        particulars: tx.particulars,
        amount: tx.amount,
        category: tx.category as Category,
        mode: tx.mode as PaymentMode,
        notes: tx.notes,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      })))
      setTotal(res.total)
      setPages(Math.max(1, res.pages))
      setIsFetching(false)
    }).catch(err => {
      if (controller.signal.aborted) return
      const u = getUserError(err, 'Failed to load transactions')
      toast.error(formatToastMessage(u))
      setIsFetching(false)
    })
    return () => controller.abort()
  }, [effectiveOnline, search, categoryFilter, modeFilter, startDate, endDate, minAmount, maxAmount, hasNotes, serverSort, page, transactionRevision])

  const goPrevPage = () => {
    if (page <= 1) return
    if (isSnapshotView) setPage(p => Math.max(1, p - 1))
    else setPage(p => Math.max(1, p - 1))
  }

  const goNextPage = () => {
    if (page >= pages) return
    if (isSnapshotView) setPage(p => Math.min(pages, p + 1))
    else setPage(p => Math.min(pages, p + 1))
  }

  const offlineFiltered = useMemo(() => {
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
    if (modeFilter !== 'All') {
      result = result.filter(t => t.mode === modeFilter)
    }
    if (startDate) {
      result = result.filter(t => (t.dateKey || t.date) >= startDate)
    }
    if (endDate) {
      result = result.filter(t => (t.dateKey || t.date) <= endDate)
    }
    if (minAmount) {
      result = result.filter(t => t.amount >= parseFloat(minAmount))
    }
    if (maxAmount) {
      result = result.filter(t => t.amount <= parseFloat(maxAmount))
    }
    if (hasNotes === 'yes') {
      result = result.filter(t => t.notes && t.notes.trim().length > 0)
    } else if (hasNotes === 'no') {
      result = result.filter(t => !t.notes || t.notes.trim().length === 0)
    }
    result.sort((a, b) => {
      switch (sort) {
        case 'date-desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        case 'date-asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        case 'amount-desc':
          return b.amount - a.amount
        case 'amount-asc':
          return a.amount - b.amount
      }
    })
    return result
  }, [
    transactions,
    search,
    categoryFilter,
    sort,
    modeFilter,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    hasNotes,
  ])

  const snapshotFiltered = useMemo(() => {
    if (!isSnapshotView) return []
    return offlineFiltered
  }, [isSnapshotView, offlineFiltered])

  useEffect(() => {
    if (!isSnapshotView) return
    const nextPages = Math.max(1, Math.ceil(snapshotFiltered.length / limit))
    const safePage = Math.min(page, nextPages)
    if (safePage !== page) setPage(safePage)
    setPages(nextPages)
    setTotal(snapshotFiltered.length)
    const start = (safePage - 1) * limit
    setPageTransactions(snapshotFiltered.slice(start, start + limit))
  }, [isSnapshotView, snapshotFiltered, page])

  const filtered = effectiveOnline ? pageTransactions : isSnapshotView ? pageTransactions : offlineFiltered

  const categories = useMemo(
    () => getAvailableCategories(settings),
    [settings],
  )

  const handleExport = async () => {
    try {
      const csv = await exportTransactionsCsv({
        search: search || undefined,
        category: categoryFilter !== 'All' ? categoryFilter : undefined,
        mode: modeFilter !== 'All' ? modeFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        minAmount: minAmount ? parseFloat(minAmount) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
        hasNotes: hasNotes !== 'All' ? hasNotes === 'yes' : undefined,
      })
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exported transactions to CSV')
    } catch (err) {
      const u = getUserError(err, 'Failed to export transactions')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  const clearFilters = () => {
    setSearchInput('')
    setSearch('')
    setCategoryFilter('All')
    setModeFilter('All')
    setStartDate('')
    setEndDate('')
    setMinAmount('')
    setMaxAmount('')
    setHasNotes('All')
    setPage(1)
  }

  const hasActiveFilters = search || categoryFilter !== 'All' || modeFilter !== 'All' || startDate || endDate || minAmount || maxAmount || hasNotes !== 'All'

  const handleDelete = async (id: string) => {
    if (isSnapshotView) return
    if (deletingId !== id) {
      setDeletingId(id)
      return
    }

    try {
      await removeTransaction(id)
      setDeletingId(null)
      if (isOnline) {
        const nextPage = page > 1 && filtered.length === 1 ? page - 1 : page
        await loadPage(nextPage)
      }
      toast.success('Transaction deleted')
    } catch (err) {
      const u = getUserError(err, 'Failed to delete transaction')
      toast.error(formatToastMessage(u))
      console.error(err)
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

  const handleBulkDelete = async () => {
    if (isSnapshotView) return
    if (!bulkDeleteConfirm) {
      setBulkDeleteConfirm(true)
      return
    }
    const ids = Array.from(selectedIds)
    const count = ids.length
    try {
      await bulkRemoveTransactions(ids)
      setSelectedIds(new Set())
      setBulkDeleteConfirm(false)
      if (isOnline) {
        const nextPage = page > 1 && ids.length >= filtered.length ? page - 1 : page
        await loadPage(nextPage)
      }
      toast.success(`${count} transaction${count !== 1 ? 's' : ''} deleted`)
    } catch (err) {
      const u = getUserError(err, 'Failed to delete selected transactions')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  const cancelBulkDelete = () => {
    setBulkDeleteConfirm(false)
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setBulkDeleteConfirm(false)
  }

  const handleBulkExport = () => {
    const selected = filtered.filter(tx => selectedIds.has(tx.id))
    if (selected.length === 0) return
    const header = 'date,particulars,amount,category,mode,notes'
    const rows = selected.map(tx => {
      const date = (tx.dateKey || tx.date || '').slice(0, 10)
      const p = `"${(tx.particulars ?? '').replace(/"/g, '""')}"`
      const n = `"${(tx.notes ?? '').replace(/"/g, '""')}"`
      return `${date},${p},${tx.amount},${tx.category},${tx.mode},${n}`
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `selected-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${selected.length} transactions`)
  }

  const SortIcon = ({ field }: { field: string }) => {
    const [f, d] = sort.split('-')
    if (f !== field) return <ArrowUpDown className="inline h-3 w-3 ml-1 opacity-40" />
    return d === 'desc' ? <ArrowDown className="inline h-3 w-3 ml-1 text-primary" /> : <ArrowUp className="inline h-3 w-3 ml-1 text-primary" />
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
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${showFilters || hasActiveFilters ? 'bg-primary/10 text-primary' : 'bg-secondary text-foreground hover:bg-muted'}`}
          >
            <Filter className="h-4 w-4" /> Filters
            {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-primary" />}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button
            onClick={() => setBulkOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            disabled={isSnapshotView}
          >
            <Upload className="h-4 w-4" /> Import
          </button>
          <button
            onClick={() => openForm()}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            disabled={isSnapshotView}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {(effectiveOnline || isSnapshotView) && pages > 1 && (
          <div className="mt-4 md:hidden flex items-center justify-between">
            <button
              onClick={goPrevPage}
              disabled={page <= 1}
              className="rounded-lg bg-secondary px-3 py-1.5 text-xs text-foreground disabled:opacity-40"
            >
              Prev
            </button>
            <div className="text-xs text-muted-foreground">
              Page {page} / {pages}
            </div>
            <button
              onClick={goNextPage}
              disabled={page >= pages}
              className="rounded-lg bg-secondary px-3 py-1.5 text-xs text-foreground disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="card-base p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Advanced Filters</span>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" /> Clear all
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Min Amount</label>
                  <input
                    type="number"
                    value={minAmount}
                    onChange={e => setMinAmount(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Max Amount</label>
                  <input
                    type="number"
                    value={maxAmount}
                    onChange={e => setMaxAmount(e.target.value)}
                    placeholder="∞"
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Mode:</label>
                  <select
                    value={modeFilter}
                    onChange={e => setModeFilter(e.target.value as PaymentMode | 'All')}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
                  >
                    <option value="All">All</option>
                    <option value="Online">Online</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Notes:</label>
                  <select
                    value={hasNotes}
                    onChange={e => setHasNotes(e.target.value as 'All' | 'yes' | 'no')}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
                  >
                    <option value="All">All</option>
                    <option value="yes">With Notes</option>
                    <option value="no">No Notes</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isSnapshotView && (
        <button
          onClick={() => openForm()}
          aria-label="Add transaction"
          className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 sm:hidden"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      )}

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
              <button onClick={handleBulkDelete} className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground">Confirm Delete</button>
              <button onClick={cancelBulkDelete} className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">Cancel</button>
            </>
          ) : (
            <>
              <button
                onClick={handleBulkExport}
                className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Export Selected
              </button>
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
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value as Category | 'All')}
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="All">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
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
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => cycleSort('date')}>Date<SortIcon field="date" /></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Day</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => cycleSort('particulars')}>Particulars<SortIcon field="particulars" /></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => cycleSort('category')}>Category<SortIcon field="category" /></th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => cycleSort('amount')}>Amount<SortIcon field="amount" /></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => cycleSort('mode')}>Mode<SortIcon field="mode" /></th>
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
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(tx.dateKey || tx.date)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{getWeekdayShort(tx.dateKey || tx.date)}</td>
                  <td className="px-4 py-3 text-foreground max-w-[200px] truncate">{tx.particulars}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        background: `${getCategoryHex(tx.category, settings)}18`,
                        color: getCategoryHex(tx.category, settings),
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: getCategoryHex(tx.category, settings) }}
                      />
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

      {/* Pagination (online only) */}
      {isOnline && pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Showing page {page} of {pages} ({total} total)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goPrevPage}
              disabled={page <= 1}
              className="rounded-lg bg-secondary px-3 py-1.5 text-xs text-foreground disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={goNextPage}
              disabled={page >= pages}
              className="rounded-lg bg-secondary px-3 py-1.5 text-xs text-foreground disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

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
                    style={{
                      background: `${getCategoryHex(tx.category, settings)}18`,
                      color: getCategoryHex(tx.category, settings),
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: getCategoryHex(tx.category, settings) }}
                    />
                    {tx.category}
                  </span>
                </div>
                <span className="text-base font-bold text-foreground">{formatCurrency(tx.amount)}</span>
              </div>
              <p className="text-sm text-foreground mb-1">{tx.particulars}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(tx.dateKey || tx.date)} · {getWeekdayShort(tx.dateKey || tx.date)}</span>
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
