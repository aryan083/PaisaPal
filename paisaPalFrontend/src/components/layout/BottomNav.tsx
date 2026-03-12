import { useStore } from '@/store'
import { LayoutDashboard, Receipt, TrendingUp, Settings, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import type { TabId } from '@/types'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'insights', label: 'Insights', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  const { activeTab, setActiveTab, openForm } = useStore()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      {/* FAB */}
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-50">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => openForm()}
          aria-label="Add transaction"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30"
        >
          <Plus className="h-6 w-6 text-primary-foreground" />
        </motion.button>
      </div>

      <nav className="flex items-center justify-around border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {TABS.map(tab => (
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
