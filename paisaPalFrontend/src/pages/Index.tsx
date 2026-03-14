import { useEffect } from 'react'
import { useStore } from '@/store'
import { useAuthStore } from '@/stores/authStore'
import { AppShell } from '@/components/layout/AppShell'
import { decodeSnapshot } from '@/lib/utils'
import { toast } from 'sonner'
import { DashboardPage } from './DashboardPage'
import { TransactionsPage } from './TransactionsPage'
import { RecurringPage } from './RecurringPage'
import { BudgetsPage } from './BudgetsPage'
import { InsightsPage } from './InsightsPage'
import { SettingsPage } from './SettingsPage'
import { AuthPage } from './AuthPage'

const Index = () => {
  const { activeTab, theme, init, applySnapshot, setSnapshotView } = useStore()
  const { isAuthenticated, checkAuth, token, hasHydrated, isLoading } = useAuthStore()

  const snapshotFromUrl = () => {
    const params = new URLSearchParams(window.location.search)
    return params.get('snapshot')
  }

  const snapshotFromSession = () => {
    try {
      return sessionStorage.getItem('pending_snapshot')
    } catch {
      return null
    }
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  useEffect(() => {
    const pending = snapshotFromUrl() ?? snapshotFromSession()
    if (isAuthenticated && !pending) {
      init()
    }
  }, [isAuthenticated, init])

  useEffect(() => {
    if (!isAuthenticated) {
      const encoded = snapshotFromUrl()
      if (encoded) {
        try {
          sessionStorage.setItem('pending_snapshot', encoded)
        } catch {
          // ignore
        }
      }
      return
    }

    const params = new URLSearchParams(window.location.search)
    const encoded = params.get('snapshot') ?? snapshotFromSession()
    if (!encoded) return

    try {
      const parsed = decodeSnapshot(encoded) as {
        transactions?: unknown
        settings?: unknown
      }
      if (!parsed || !Array.isArray(parsed.transactions) || !parsed.settings) {
        throw new Error('Invalid snapshot payload')
      }

      void applySnapshot({
        transactions: parsed.transactions as any,
        settings: parsed.settings as any,
      }).then(() => {
        try {
          sessionStorage.removeItem('pending_snapshot')
        } catch {
          // ignore
        }
        params.delete('snapshot')
        const next = params.toString()
        const url = `${window.location.pathname}${next ? `?${next}` : ''}`
        window.history.replaceState({}, '', url)
        toast.success('Snapshot restored')
      })
    } catch {
      toast.error('Failed to restore snapshot')
    }
  }, [isAuthenticated, applySnapshot])

  useEffect(() => {
    if (isAuthenticated) return
    const encoded = snapshotFromUrl()
    if (!encoded) return

    try {
      const parsed = decodeSnapshot(encoded) as {
        transactions?: unknown
        settings?: unknown
        budgets?: unknown
      }
      if (!parsed || !Array.isArray(parsed.transactions) || !parsed.settings) {
        throw new Error('Invalid snapshot payload')
      }

      void applySnapshot({
        transactions: parsed.transactions as any,
        settings: parsed.settings as any,
        budgets: Array.isArray(parsed.budgets) ? (parsed.budgets as any) : [],
        viewOnly: true,
      }).then(() => {
        setSnapshotView(true)
        toast.success('Snapshot opened (view only)')
      })
    } catch {
      toast.error('Failed to open snapshot')
    }
  }, [isAuthenticated, applySnapshot, setSnapshotView])

  useEffect(() => {
    if (token) {
      checkAuth()
    }
  }, [token, checkAuth])

  if (!hasHydrated || (token && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    const hasSnapshot = Boolean(snapshotFromUrl() ?? snapshotFromSession())
    if (!hasSnapshot) return <AuthPage />
  }

  return (
    <AppShell>
      {activeTab === 'dashboard' && <DashboardPage />}
      {activeTab === 'transactions' && <TransactionsPage />}
      {activeTab === 'recurring' && <RecurringPage />}
      {activeTab === 'budgets' && <BudgetsPage />}
      {activeTab === 'insights' && <InsightsPage />}
      {activeTab === 'settings' && <SettingsPage />}
    </AppShell>
  )
}

export default Index
