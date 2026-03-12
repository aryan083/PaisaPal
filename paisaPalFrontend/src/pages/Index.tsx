import { useEffect } from 'react'
import { useStore } from '@/store'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from './DashboardPage'
import { TransactionsPage } from './TransactionsPage'
import { RecurringPage } from './RecurringPage'
import { BudgetsPage } from './BudgetsPage'
import { InsightsPage } from './InsightsPage'
import { SettingsPage } from './SettingsPage'

const Index = () => {
  const { activeTab, theme, init } = useStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    init()
  }, [])

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
