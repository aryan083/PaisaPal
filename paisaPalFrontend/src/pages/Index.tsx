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
  const { activeTab, theme, init, applySnapshot } = useStore()
  const { isAuthenticated, checkAuth, token, hasHydrated, isLoading } = useAuthStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      init()
    }
  }, [isAuthenticated, init])

  useEffect(() => {
    if (!isAuthenticated) return
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get('snapshot')
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
    return <AuthPage />
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
