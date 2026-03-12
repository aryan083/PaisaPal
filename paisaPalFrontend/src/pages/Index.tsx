import { useEffect } from 'react'
import { useStore } from '@/store'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from './DashboardPage'
import { TransactionsPage } from './TransactionsPage'
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
      {activeTab === 'insights' && <InsightsPage />}
      {activeTab === 'settings' && <SettingsPage />}
    </AppShell>
  )
}

export default Index
