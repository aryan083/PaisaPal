import { useStore } from '@/store'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { Header } from './Header'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-[1280px] p-4 pb-24 lg:p-6 lg:pb-6">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <div className="lg:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}
