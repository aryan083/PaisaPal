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
        saveTransactions(transactions)
        saveSettings(settings)
        get().computeStats()
      } catch (err) {
        console.error(err)
        const transactions = getTransactions()
        const settings = getSettings()
        set({ transactions, settings })
        get().computeStats()
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
    try {
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
      saveTransactions(txs)
      get().computeStats()
    } finally {
      set({ isLoading: false })
    }
  },

  remapCategory: async (fromCategory, toCategory) => {
    set({ isLoading: true })
    try {
      await remapCategoryApi({ fromCategory, toCategory })

      const txs = get().transactions.map(tx =>
        tx.category === fromCategory ? { ...tx, category: toCategory } : tx,
      )
      set({ transactions: txs })
      saveTransactions(txs)
      get().computeStats()
    } finally {
      set({ isLoading: false })
    }
  },

  updateTransaction: async (id, data) => {
    set({ isLoading: true })
    try {
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
      saveTransactions(txs)
      get().computeStats()
    } finally {
      set({ isLoading: false })
    }
  },

  removeTransaction: async (id) => {
    set({ isLoading: true })
    try {
      await deleteTransactionApi(id)
      const txs = get().transactions.filter(tx => tx.id !== id)
      set({ transactions: txs })
      saveTransactions(txs)
      get().computeStats()
    } finally {
      set({ isLoading: false })
    }
  },

  updateSettings: async (s) => {
    set({ isLoading: true })
    try {
      const updated = await updateSettingsApi(s)
      const settings: Settings = {
        stipend: updated.stipend,
        extra: updated.extra,
        categoryConfig: updated.categoryConfig ?? [],
      }
      set({ settings })
      saveSettings(settings)
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
