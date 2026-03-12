import { useStore } from '@/store'
import { LayoutDashboard, Receipt, TrendingUp, Settings, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TabId } from '@/types'

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'insights', label: 'Insights', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const { activeTab, setActiveTab, theme, setTheme } = useStore()

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-primary-foreground">₹</span>
        </div>
        <span className="text-display text-lg font-bold text-foreground">Paisa Tracker</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {NAV_ITEMS.map(item => (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                aria-label={item.label}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                  activeTab === item.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-4">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <p className="mt-2 px-4 text-xs text-muted-foreground/50">v1.0.0</p>
      </div>
    </aside>
  )
}
