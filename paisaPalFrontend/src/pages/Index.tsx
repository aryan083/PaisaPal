import { useEffect } from 'react'
import { useStore } from '@/store'
import { useAuthStore } from '@/stores/authStore'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from './DashboardPage'
import { TransactionsPage } from './TransactionsPage'
import { RecurringPage } from './RecurringPage'
import { BudgetsPage } from './BudgetsPage'
import { InsightsPage } from './InsightsPage'
import { SettingsPage } from './SettingsPage'
import { AuthPage } from './AuthPage'

const Index = () => {
  const { activeTab, theme, init } = useStore()
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
    if (token) {
      checkAuth()
    }
  }, [token, checkAuth])

  if (!hasHydrated || (token && isLoading)) {
    return null
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
