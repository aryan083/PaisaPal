import { create } from 'zustand'
import type {
  Envelope,
  RecurringTransaction,
  SavingsGoal,
  SavingsStats,
  Settings,
  Stats,
  TabId,
  Transaction,
} from '@/types'
import { getTransactions, saveTransactions, getSettings, saveSettings } from '@/lib/storage'
import type { Category } from '@/types'
import type { ApiBudget } from '@/lib/api'
import {
  bulkDeleteTransactionsApi,
  createTransactionApi,
  deleteTransactionApi,
  fetchAllTransactions,
  fetchSettings,
  fetchTransactions,
  remapCategoryApi,
  updateSettingsApi,
  updateTransactionApi,
} from '@/lib/api'

import { toLocalDateKey } from '@/lib/utils'

import { useAuthStore } from '@/stores/authStore'
import { useSyncStore } from '@/stores/syncStore'

interface AppStore {
  transactions: Transaction[]
  transactionRevision: number
  settings: Settings
  stats: Stats | null
  savingsGoals: SavingsGoal[]
  recurringTransactions: RecurringTransaction[]
  envelopes: Envelope | null
  savingsStats: SavingsStats | null
  activeTab: TabId
  theme: 'dark' | 'light'
  sidebarCollapsed: boolean
  formOpen: boolean
  editingTransaction: Transaction | null
  isLoading: boolean

  isSnapshotView: boolean
  snapshotBudgets: ApiBudget[]

  init: () => void
  applySnapshot: (data: {
    transactions: Transaction[]
    settings: Settings
    budgets?: ApiBudget[]
    viewOnly?: boolean
  }) => Promise<void>
  setSnapshotView: (v: boolean) => void
  setActiveTab: (tab: TabId) => void
  setTheme: (t: 'dark' | 'light') => void
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebarCollapsed: () => void
  openForm: (tx?: Transaction) => void
  closeForm: () => void
  repeatTransaction: (tx: Transaction) => void
  addTransaction: (
    tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>
  updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>
  removeTransaction: (id: string) => Promise<void>
  bulkRemoveTransactions: (ids: string[]) => Promise<void>
  bulkAddTransactions: (
    txs: Array<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>>,
  ) => Promise<void>
  updateSettings: (s: Partial<Settings>) => Promise<void>
  remapCategory: (fromCategory: string, toCategory: string) => Promise<void>
  computeStats: () => void

  setSavingsGoals: (goals: SavingsGoal[]) => void
  addSavingsGoal: (goal: SavingsGoal) => void
  updateSavingsGoal: (id: string, goal: SavingsGoal) => void
  removeSavingsGoal: (id: string) => void

  setRecurringTransactions: (items: RecurringTransaction[]) => void
  addRecurringTransaction: (item: RecurringTransaction) => void
  updateRecurringTransaction: (id: string, item: RecurringTransaction) => void
  removeRecurringTransaction: (id: string) => void

  setEnvelopes: (env: Envelope | null) => void
  setSavingsStats: (stats: SavingsStats | null) => void
}

export const useStore = create<AppStore>((set, get) => ({
  transactions: [],
  transactionRevision: 0,
  settings: { stipend: 12000, extra: 0, categoryConfig: [] },
  stats: null,
  savingsGoals: [],
  recurringTransactions: [],
  envelopes: null,
  savingsStats: null,
  activeTab: (localStorage.getItem('paisa-active-tab') as TabId) || 'dashboard',
  theme: (localStorage.getItem('paisa-theme') as 'dark' | 'light') || 'dark',
  sidebarCollapsed: localStorage.getItem('paisa-sidebar-collapsed') === 'true',
  formOpen: false,
  editingTransaction: null,
  isLoading: false,

  isSnapshotView: false,
  snapshotBudgets: [],

  init: () => {
    void (async () => {
      set({ isLoading: true })

      const auth = useAuthStore.getState()
      const namespace = auth.user?._id ?? 'anonymous'

      const cachedTxs = await getTransactions(namespace)
      const cachedSettings = await getSettings(namespace)
      if (cachedTxs.length > 0) {
        set({ transactions: cachedTxs, settings: cachedSettings })
        get().computeStats()
        set({ isLoading: false })
      }

      const online = useSyncStore.getState().isOnline
      if (!online) {
        set({ isLoading: false })
        return
      }

      try {
        const [apiTransactions, apiSettings] = await Promise.all([
          fetchAllTransactions(),
          fetchSettings(),
        ])

        const transactions: Transaction[] = apiTransactions.map(tx => ({
          id: tx._id,
          date: tx.date,
          dateKey: tx.dateKey,
          particulars: tx.particulars,
          amount: tx.amount,
          category: tx.category as Transaction['category'],
          mode: tx.mode,
          notes: tx.notes,
          createdAt: tx.createdAt,
          updatedAt: tx.updatedAt,
        }))

        const settings: Settings = {
          stipend: apiSettings.stipend,
          extra: apiSettings.extra,
          categoryConfig: apiSettings.categoryConfig ?? [],
          rapidoTaxEnabled: apiSettings.rapidoTaxEnabled,
          rapidoTaxPercent: apiSettings.rapidoTaxPercent,
          primarySavingsGoalId: apiSettings.primarySavingsGoalId,
          monthEndReminderEnabled: apiSettings.monthEndReminderEnabled,
          envelopeWarningThreshold: apiSettings.envelopeWarningThreshold,
        }

        set({ transactions, settings })
        await saveTransactions(transactions, namespace)
        await saveSettings(settings, namespace)
        get().computeStats()
      } catch (err) {
        console.error(err)
        // keep cached
      } finally {
        set((s) => (s.isLoading ? { isLoading: false } : s))
      }
    })()
  },

  applySnapshot: async (data) => {
    const auth = useAuthStore.getState()
    const namespace = auth.user?._id ?? 'anonymous'
    const txs = data.transactions
    const settings = data.settings

    const budgets = data.budgets ?? []
    const viewOnly = Boolean(data.viewOnly)

    set({
      transactions: txs,
      settings,
      snapshotBudgets: budgets,
      isSnapshotView: viewOnly,
    })
    await Promise.all([
      saveTransactions(txs, namespace),
      saveSettings(settings, namespace),
    ])
    get().computeStats()
  },

  setSnapshotView: (v) => set({ isSnapshotView: v }),

  setActiveTab: (tab) => {
    localStorage.setItem('paisa-active-tab', tab)
    set({ activeTab: tab })
  },

  setTheme: (t) => {
    localStorage.setItem('paisa-theme', t)
    document.documentElement.setAttribute('data-theme', t)
    set({ theme: t })
  },

  setSidebarCollapsed: (v) => {
    localStorage.setItem('paisa-sidebar-collapsed', String(v))
    set({ sidebarCollapsed: v })
  },
  toggleSidebarCollapsed: () => {
    const next = !get().sidebarCollapsed
    localStorage.setItem('paisa-sidebar-collapsed', String(next))
    set({ sidebarCollapsed: next })
  },

  openForm: (tx) => set({ formOpen: true, editingTransaction: tx || null }),
  closeForm: () => set({ formOpen: false, editingTransaction: null }),
  repeatTransaction: (tx) => {
    const today = toLocalDateKey(new Date())
    get().openForm({
      ...tx,
      id: undefined as unknown as string,
      date: today,
      dateKey: today,
    })
  },

  addTransaction: async (data) => {
    set({ isLoading: true })
    const auth = useAuthStore.getState()
    const namespace = auth.user?._id ?? 'anonymous'
    const online = useSyncStore.getState().isOnline

    try {
      if (online) {
        const created = await createTransactionApi(data)
        const tx: Transaction = {
          id: created._id,
          date: created.date,
          dateKey: created.dateKey,
          particulars: created.particulars,
          amount: created.amount,
          category: created.category as Transaction['category'],
          mode: created.mode,
          notes: created.notes,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        }
        const txs = [tx, ...get().transactions]
        set((s) => ({ transactions: txs, transactionRevision: s.transactionRevision + 1 }))
        await saveTransactions(txs, namespace)
        get().computeStats()
        return
      }

      const now = new Date().toISOString()
      const localTx: Transaction = {
        id: crypto.randomUUID(),
        date: data.date,
        dateKey: data.date,
        particulars: data.particulars,
        amount: data.amount,
        category: data.category,
        mode: data.mode,
        notes: data.notes,
        createdAt: now,
        updatedAt: now,
      }

      const txs = [localTx, ...get().transactions]
      set((s) => ({ transactions: txs, transactionRevision: s.transactionRevision + 1 }))
      await saveTransactions(txs, namespace)
      get().computeStats()

      useSyncStore.getState().addToQueue({
        operation: 'create',
        resource: 'transaction',
        data: { ...data, clientId: localTx.id },
      })
    } finally {
      set({ isLoading: false })
    }
  },

  bulkRemoveTransactions: async (ids) => {
    if (ids.length === 0) return

    set({ isLoading: true })
    const auth = useAuthStore.getState()
    const namespace = auth.user?._id ?? 'anonymous'
    const online = useSyncStore.getState().isOnline

    try {
      if (online) {
        await bulkDeleteTransactionsApi(ids)
      } else {
        for (const id of ids) {
          useSyncStore.getState().addToQueue({
            operation: 'delete',
            resource: 'transaction',
            data: { clientId: id },
          })
        }
      }

      const idSet = new Set(ids)
      const txs = get().transactions.filter((t) => !idSet.has(t.id))
      set((s) => ({ transactions: txs, transactionRevision: s.transactionRevision + 1 }))
      await saveTransactions(txs, namespace)
      get().computeStats()
    } finally {
      set({ isLoading: false })
    }
  },

  bulkAddTransactions: async (items) => {
    if (items.length === 0) return

    set({ isLoading: true })
    const auth = useAuthStore.getState()
    const namespace = auth.user?._id ?? 'anonymous'
    const online = useSyncStore.getState().isOnline

    try {
      if (online) {
        const created = await Promise.all(items.map((i) => createTransactionApi(i)))
        const newTxs: Transaction[] = created.map((c) => ({
          id: c._id,
          date: c.date,
          dateKey: c.dateKey,
          particulars: c.particulars,
          amount: c.amount,
          category: c.category as Transaction['category'],
          mode: c.mode,
          notes: c.notes,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }))

        const txs = [...newTxs, ...get().transactions]
        set((s) => ({ transactions: txs, transactionRevision: s.transactionRevision + 1 }))
        await saveTransactions(txs, namespace)
        get().computeStats()
        return
      }

      const now = new Date().toISOString()
      const newTxs: Transaction[] = items.map((i) => ({
        id: crypto.randomUUID(),
        date: i.date,
        dateKey: i.date,
        particulars: i.particulars,
        amount: i.amount,
        category: i.category,
        mode: i.mode,
        notes: i.notes,
        createdAt: now,
        updatedAt: now,
      }))

      const txs = [...newTxs, ...get().transactions]
      set((s) => ({ transactions: txs, transactionRevision: s.transactionRevision + 1 }))
      await saveTransactions(txs, namespace)
      get().computeStats()

      for (let idx = 0; idx < newTxs.length; idx += 1) {
        const localTx = newTxs[idx]
        const item = items[idx]
        if (!localTx || !item) continue
        useSyncStore.getState().addToQueue({
          operation: 'create',
          resource: 'transaction',
          data: { ...item, clientId: localTx.id },
        })
      }
    } finally {
      set({ isLoading: false })
    }
  },

  remapCategory: async (fromCategory, toCategory) => {
    set({ isLoading: true })
    const auth = useAuthStore.getState()
    const namespace = auth.user?._id ?? 'anonymous'
    const online = useSyncStore.getState().isOnline
    try {
      if (online) {
        await remapCategoryApi({ fromCategory, toCategory })
      }

      const txs = get().transactions.map(tx =>
        tx.category === fromCategory ? { ...tx, category: toCategory } : tx,
      )
      set((s) => ({ transactions: txs, transactionRevision: s.transactionRevision + 1 }))

      await saveTransactions(txs, namespace)
      get().computeStats()

      if (!online) {
        for (const tx of get().transactions) {
          if (tx.category !== toCategory) continue
          useSyncStore.getState().addToQueue({
            operation: 'update',
            resource: 'transaction',
            data: { clientId: tx.id, category: toCategory },
          })
        }
      }
    } finally {
      set({ isLoading: false })
    }
  },

  updateTransaction: async (id, data) => {
    set({ isLoading: true })
    const auth = useAuthStore.getState()
    const namespace = auth.user?._id ?? 'anonymous'
    const online = useSyncStore.getState().isOnline

    try {
      if (online) {
        const updated = await updateTransactionApi(id, data)
        const txs = get().transactions.map((tx) =>
          tx.id === id
            ? {
                ...tx,
                date: updated.date,
                dateKey: updated.dateKey,
                particulars: updated.particulars,
                amount: updated.amount,
                category: updated.category as Transaction['category'],
                mode: updated.mode,
                notes: updated.notes,
                updatedAt: updated.updatedAt,
              }
            : tx,
        )
        set((s) => ({ transactions: txs, transactionRevision: s.transactionRevision + 1 }))
        await saveTransactions(txs, namespace)
        get().computeStats()
        return
      }

      const txs = get().transactions.map(tx =>
        tx.id === id ? { ...tx, ...data, updatedAt: new Date().toISOString() } : tx,
      )
      set((s) => ({ transactions: txs, transactionRevision: s.transactionRevision + 1 }))
      await saveTransactions(txs, namespace)
      get().computeStats()

      useSyncStore.getState().addToQueue({
        operation: 'update',
        resource: 'transaction',
        data: { ...data, clientId: id },
      })
    } finally {
      set({ isLoading: false })
    }
  },

  removeTransaction: async (id) => {
    set({ isLoading: true })
    const auth = useAuthStore.getState()
    const namespace = auth.user?._id ?? 'anonymous'
    const online = useSyncStore.getState().isOnline

    try {
      if (online) {
        await deleteTransactionApi(id)
      } else {
        useSyncStore.getState().addToQueue({
          operation: 'delete',
          resource: 'transaction',
          data: { clientId: id },
        })
      }

      const txs = get().transactions.filter(tx => tx.id !== id)
      set((s) => ({ transactions: txs, transactionRevision: s.transactionRevision + 1 }))
      await saveTransactions(txs, namespace)
      get().computeStats()
    } finally {
      set({ isLoading: false })
    }
  },

  updateSettings: async (s) => {
    set({ isLoading: true })
    const auth = useAuthStore.getState()
    const namespace = auth.user?._id ?? 'anonymous'
    const online = useSyncStore.getState().isOnline

    try {
      if (online) {
        const updated = await updateSettingsApi(s)
        const settings: Settings = {
          stipend: updated.stipend,
          extra: updated.extra,
          categoryConfig: updated.categoryConfig ?? [],
          rapidoTaxEnabled: updated.rapidoTaxEnabled,
          rapidoTaxPercent: updated.rapidoTaxPercent,
          primarySavingsGoalId: updated.primarySavingsGoalId,
          monthEndReminderEnabled: updated.monthEndReminderEnabled,
          envelopeWarningThreshold: updated.envelopeWarningThreshold,
        }
        set({ settings })
        await saveSettings(settings, namespace)
        get().computeStats()
        return
      }

      const next: Settings = { ...get().settings, ...s }
      set({ settings: next })
      await saveSettings(next, namespace)

      useSyncStore.getState().addToQueue({
        operation: 'update',
        resource: 'settings',
        data: s as Record<string, unknown>,
      })
      get().computeStats()
    } finally {
      set({ isLoading: false })
    }
  },

  computeStats: () => {
    const { transactions } = get()
    if (!transactions.length) {
      set({ stats: null })
      return
    }

    const totalSpent = transactions.reduce((s, t) => s + t.amount, 0)

    const catMap = new Map<Category, { total: number; count: number }>()
    transactions.forEach(t => {
      const category = (t.category || 'Other') as Category
      const existing = catMap.get(category) || { total: 0, count: 0 }
      catMap.set(category, { total: existing.total + t.amount, count: existing.count + 1 })
    })
    const byCategory = Array.from(catMap.entries()).map(([category, data]) => ({
      category, ...data
    })).sort((a, b) => b.total - a.total)

    const dateMap = new Map<string, number>()
    transactions.forEach(t => {
      const d = t.dateKey || toLocalDateKey(t.date)
      dateMap.set(d, (dateMap.get(d) || 0) + t.amount)
    })
    const byDate = Array.from(dateMap.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const byMode = { Online: 0, Cash: 0,Card:0 }
    transactions.forEach(t => { byMode[t.mode] += t.amount })

    const activeDays = dateMap.size
    const dailyAverage = activeDays > 0 ? Math.round(totalSpent / activeDays) : 0

    let biggestDay = { date: '', total: 0 }
    byDate.forEach(d => { if (d.total > biggestDay.total) biggestDay = d })

    const biggestTransaction = transactions.reduce<Transaction | null>((max, t) =>
      !max || t.amount > max.amount ? t : max, null)

    const rapidoTxs = transactions.filter(t => t.category === 'Rapido')
    const rapidoTotal = rapidoTxs.reduce((s, t) => s + t.amount, 0)
    const rapidoStats = {
      total: rapidoTotal,
      count: rapidoTxs.length,
      avgPerRide: rapidoTxs.length > 0 ? Math.round(rapidoTotal / rapidoTxs.length) : 0
    }

    set({
      stats: {
        totalSpent, byCategory, byDate, byMode,
        transactionCount: transactions.length,
        activeDays, dailyAverage, biggestDay, biggestTransaction, rapidoStats
      }
    })
  },

  setSavingsGoals: (goals) => set({ savingsGoals: goals }),
  addSavingsGoal: (goal) => set((s) => ({ savingsGoals: [goal, ...s.savingsGoals] })),
  updateSavingsGoal: (id, goal) =>
    set((s) => ({ savingsGoals: s.savingsGoals.map((g) => (g._id === id ? goal : g)) })),
  removeSavingsGoal: (id) =>
    set((s) => ({ savingsGoals: s.savingsGoals.filter((g) => g._id !== id) })),

  setRecurringTransactions: (items) => set({ recurringTransactions: items }),
  addRecurringTransaction: (item) =>
    set((s) => ({ recurringTransactions: [item, ...s.recurringTransactions] })),
  updateRecurringTransaction: (id, item) =>
    set((s) => ({
      recurringTransactions: s.recurringTransactions.map((r) => (r._id === id ? item : r)),
    })),
  removeRecurringTransaction: (id) =>
    set((s) => ({ recurringTransactions: s.recurringTransactions.filter((r) => r._id !== id) })),

  setEnvelopes: (env) => set({ envelopes: env }),
  setSavingsStats: (stats) => set({ savingsStats: stats }),
}))
