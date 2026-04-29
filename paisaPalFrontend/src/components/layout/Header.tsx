import { useState } from 'react'
import { useStore } from '@/store'
import { Moon, Sun, Activity, LogOut, User } from 'lucide-react'
import { ActivityFeed } from '@/components/activity/ActivityFeed'
import { useAuthStore } from '@/stores/authStore'

export function Header() {
  const { theme, setTheme } = useStore()
  const { user, logout } = useAuthStore()
  const [showActivity, setShowActivity] = useState(false)

  return (
    <>
      <header className="glass sticky top-0 z-30 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <span className="text-xs font-bold text-primary-foreground">₹</span>
          </div>
          <span className="text-display text-base font-bold text-foreground">Paisa Tracker</span>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <div className="flex lg:hidden items-center gap-2 rounded-lg bg-secondary px-2 py-1 max-w-[160px]">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground max-w-[140px] truncate">
                {user.name}
              </span>
            </div>
          )}
          {user && (
            <button
              onClick={() => setShowActivity(true)}
              aria-label="Activity feed"
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary transition-colors"
            >
              <Activity className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary transition-colors lg:hidden"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {user && (
            <button
              onClick={logout}
              aria-label="Logout"
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary transition-colors lg:hidden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>
      <ActivityFeed isOpen={showActivity} onClose={() => setShowActivity(false)} />
    </>
  )
}
