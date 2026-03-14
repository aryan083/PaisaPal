import { useStore } from '@/store'
import { LayoutDashboard, Receipt, TrendingUp, Settings, Plus, Repeat, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import type { TabId } from '@/types'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'recurring', label: 'Recurring', icon: Repeat },
  { id: 'budgets', label: 'Budgets', icon: Wallet },
  { id: 'insights', label: 'Insights', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  const { activeTab, setActiveTab, isSnapshotView } = useStore()

  const tabs = isSnapshotView
    ? TABS.filter(t => t.id === 'dashboard' || t.id === 'transactions' || t.id === 'budgets')
    : TABS

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <nav className="flex items-center justify-around border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-label={tab.label}
            className={cn(
              'relative flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors',
              activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <tab.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-dot"
                className="absolute -bottom-1 h-1 w-1 rounded-full bg-primary"
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
