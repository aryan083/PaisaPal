import { create } from 'zustand'
import type { Transaction, Settings, Stats, TabId } from '@/types'
import { getTransactions, saveTransactions, getSettings, saveSettings } from '@/lib/storage'
import type { Category } from '@/types'
import {
  createTransactionApi,
  deleteTransactionApi,
  fetchSettings,
  fetchTransactions,
  remapCategoryApi,
  updateSettingsApi,
  updateTransactionApi,
} from '@/lib/api'

import { useAuthStore } from '@/stores/authStore'
import { useSyncStore } from '@/stores/syncStore'

interface AppStore {
  transactions: Transaction[]
  settings: Settings
  stats: Stats | null
  activeTab: TabId
  theme: 'dark' | 'light'
  formOpen: boolean
  editingTransaction: Transaction | null
  isLoading: boolean

  init: () => void
  setActiveTab: (tab: TabId) => void
  setTheme: (t: 'dark' | 'light') => void
  openForm: (tx?: Transaction) => void
  closeForm: () => void
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
}

export const useStore = create<AppStore>((set, get) => ({
  transactions: [],
  settings: { stipend: 12000, extra: 0, categoryConfig: [] },
  stats: null,
  activeTab: 'dashboard',
  theme: (localStorage.getItem('paisa-theme') as 'dark' | 'light') || 'dark',
  formOpen: false,
  editingTransaction: null,
  isLoading: false,

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
      }

      const online = useSyncStore.getState().isOnline
      if (!online) {
        set({ isLoading: false })
        return
      }

      try {
        const [apiTransactions, apiSettings] = await Promise.all([
          fetchTransactions(),
          fetchSettings(),
        ])

        const transactions: Transaction[] = apiTransactions.map(tx => ({
          id: tx._id,
          date: tx.date,
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
        }

        set({ transactions, settings })
        await saveTransactions(transactions, namespace)
        await saveSettings(settings, namespace)
        get().computeStats()
      } catch (err) {
        console.error(err)
        // keep cached
      } finally {
        set({ isLoading: false })
      }
    })()
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setTheme: (t) => {
    localStorage.setItem('paisa-theme', t)
    document.documentElement.setAttribute('data-theme', t)
    set({ theme: t })
  },

  openForm: (tx) => set({ formOpen: true, editingTransaction: tx || null }),
  closeForm: () => set({ formOpen: false, editingTransaction: null }),

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
          particulars: created.particulars,
          amount: created.amount,
          category: created.category as Transaction['category'],
          mode: created.mode,
          notes: created.notes,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        }
        const txs = [tx, ...get().transactions]
        set({ transactions: txs })
        await saveTransactions(txs, namespace)
        get().computeStats()
        return
      }

      const now = new Date().toISOString()
      const localTx: Transaction = {
        id: crypto.randomUUID(),
        date: data.date,
        particulars: data.particulars,
        amount: data.amount,
        category: data.category,
        mode: data.mode,
        notes: data.notes,
        createdAt: now,
        updatedAt: now,
      }

      const txs = [localTx, ...get().transactions]
      set({ transactions: txs })
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
        await Promise.all(ids.map((id) => deleteTransactionApi(id)))
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
      set({ transactions: txs })
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
          particulars: c.particulars,
          amount: c.amount,
          category: c.category as Transaction['category'],
          mode: c.mode,
          notes: c.notes,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }))

        const txs = [...newTxs, ...get().transactions]
        set({ transactions: txs })
        await saveTransactions(txs, namespace)
        get().computeStats()
        return
      }

      const now = new Date().toISOString()
      const localTxs: Transaction[] = items.map((i) => ({
        id: crypto.randomUUID(),
        date: i.date,
        particulars: i.particulars,
        amount: i.amount,
        category: i.category,
        mode: i.mode,
        notes: i.notes,
        createdAt: now,
        updatedAt: now,
      }))

      const txs = [...localTxs, ...get().transactions]
      set({ transactions: txs })
      await saveTransactions(txs, namespace)
      get().computeStats()

      for (let idx = 0; idx < localTxs.length; idx += 1) {
        const localTx = localTxs[idx]
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
      set({ transactions: txs })

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
        const txs = get().transactions.map(tx =>
          tx.id === id ? {
            ...tx,
            date: updated.date,
            particulars: updated.particulars,
            amount: updated.amount,
            category: updated.category as Transaction['category'],
            mode: updated.mode,
            notes: updated.notes,
            updatedAt: updated.updatedAt,
          } : tx
        )
        set({ transactions: txs })
        await saveTransactions(txs, namespace)
        get().computeStats()
        return
      }

      const txs = get().transactions.map(tx =>
        tx.id === id ? { ...tx, ...data, updatedAt: new Date().toISOString() } : tx,
      )
      set({ transactions: txs })
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
      set({ transactions: txs })
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
      const existing = catMap.get(t.category) || { total: 0, count: 0 }
      catMap.set(t.category, { total: existing.total + t.amount, count: existing.count + 1 })
    })
    const byCategory = Array.from(catMap.entries()).map(([category, data]) => ({
      category, ...data
    })).sort((a, b) => b.total - a.total)

    const dateMap = new Map<string, number>()
    transactions.forEach(t => {
      const d = t.date.split('T')[0]
      dateMap.set(d, (dateMap.get(d) || 0) + t.amount)
    })
    const byDate = Array.from(dateMap.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const byMode = { Online: 0, Cash: 0 }
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
}))
