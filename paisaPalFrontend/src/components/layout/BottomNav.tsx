import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/store'
import { LayoutDashboard, Receipt, Settings, Wallet, PiggyBank, RefreshCw, TrendingUp, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import type { TabId } from '@/types'

const PRIMARY_TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'transactions', label: 'Txns', icon: Receipt },
  { id: 'savings', label: 'Savings', icon: PiggyBank },
  { id: 'recurring', label: 'Recurring', icon: RefreshCw },
  { id: 'envelopes', label: 'Envelopes', icon: Wallet },
]

const MORE_TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'insights', label: 'Insights', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  const { activeTab, setActiveTab, isSnapshotView } = useStore()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const primaryTabs = isSnapshotView
    ? PRIMARY_TABS.filter(t => t.id === 'dashboard' || t.id === 'transactions' || t.id === 'envelopes')
    : PRIMARY_TABS

  const moreTabs = isSnapshotView ? [] : MORE_TABS

  const isMoreActive = MORE_TABS.some(t => t.id === activeTab)

  // Close more menu on outside click
  useEffect(() => {
    if (!moreOpen) return
    const handler = (e: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('pointerdown', handler, { passive: true })
    return () => document.removeEventListener('pointerdown', handler)
  }, [moreOpen])

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <nav className="flex items-center justify-around border-t border-border bg-card px-1 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {primaryTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setMoreOpen(false) }}
            aria-label={tab.label}
            className={cn(
              'relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 text-xs transition-colors min-w-0',
              activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <tab.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-tight truncate max-w-[56px]">{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-dot"
                className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary"
              />
            )}
          </button>
        ))}

        {/* More button */}
        {moreTabs.length > 0 && (
          <div ref={moreRef} className="relative">
            <button
              onClick={() => setMoreOpen(prev => !prev)}
              aria-label="More options"
              className={cn(
                'relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 text-xs transition-colors min-w-0',
                isMoreActive || moreOpen ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-tight">More</span>
              {isMoreActive && !moreOpen && (
                <motion.div
                  layoutId="tab-dot"
                  className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary"
                />
              )}
            </button>

            {/* Popover menu */}
            <AnimatePresence>
              {moreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute bottom-full right-0 mb-2 min-w-[140px] rounded-xl border border-border bg-card shadow-lg overflow-hidden"
                >
                  {moreTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id)
                        setMoreOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-sm font-medium transition-colors',
                        activeTab === tab.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-secondary'
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </nav>
    </div>
  )
}
