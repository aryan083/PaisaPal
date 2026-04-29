import { useStore } from '@/store'
import { useAuthStore } from '@/stores/authStore'
import { LayoutDashboard, Receipt, TrendingUp, Settings, Moon, Sun, Repeat, Wallet, LogOut, User, ChevronLeft, ChevronRight, Menu, PiggyBank, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TabId } from '@/types'

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'savings', label: 'Savings', icon: PiggyBank },
  { id: 'recurring', label: 'Recurring', icon: RefreshCw },
  { id: 'envelopes', label: 'Envelopes', icon: Wallet },
  { id: 'insights', label: 'Insights', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const {
    activeTab,
    setActiveTab,
    theme,
    setTheme,
    isSnapshotView,
    sidebarCollapsed,
    toggleSidebarCollapsed,
  } = useStore()
  const { user, logout } = useAuthStore()
  const collapsed = sidebarCollapsed

  const navItems = isSnapshotView
    ? NAV_ITEMS.filter(i => i.id === 'dashboard' || i.id === 'transactions' || i.id === 'envelopes')
    : NAV_ITEMS

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-border bg-card transition-all duration-300",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between px-3 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary flex-shrink-0">
            <span className="text-sm font-bold text-primary-foreground">₹</span>
          </div>
          {!collapsed && (
            <span className="text-display text-lg font-bold text-foreground">Paisa Tracker</span>
          )}
        </div>
        <button
          onClick={toggleSidebarCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2">
        <ul className="space-y-1">
          {navItems.map(item => (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                aria-label={item.label}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  activeTab === item.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  collapsed && 'justify-center'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-2 py-4">
        {/* User info */}
        {user && !collapsed && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg bg-secondary/50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        )}
        
        {user && collapsed && (
          <div className="flex justify-center mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10" title={user.email}>
              <User className="h-4 w-4 text-primary" />
            </div>
          </div>
        )}
        
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
          title={collapsed ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors',
            collapsed && 'justify-center'
          )}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        
        {user && !isSnapshotView && (
          <button
            onClick={logout}
            aria-label="Logout"
            title={collapsed ? 'Logout' : undefined}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors',
              collapsed && 'justify-center'
            )}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span>Logout</span>}
          </button>
        )}
        
        {!collapsed && <p className="mt-2 px-3 text-xs text-muted-foreground/50">v1.0.0</p>}
      </div>
    </aside>
  )
}
