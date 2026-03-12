import { motion } from 'framer-motion'
import { useStore } from '@/store'
import { useState } from 'react'
import { Sun, Moon, Download, Copy } from 'lucide-react'
import { CATEGORIES, CATEGORY_HEX } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

export function SettingsPage() {
  const { settings, updateSettings, theme, setTheme, transactions, stats } = useStore()
  const [stipend, setStipend] = useState(String(settings.stipend))
  const [extra, setExtra] = useState(String(settings.extra))

  const handleSave = () => {
    updateSettings({ stipend: parseInt(stipend) || 0, extra: parseInt(extra) || 0 })
    toast.success('Settings saved')
  }

  const exportCSV = () => {
    const header = 'Date,Particulars,Amount,Category,Mode,Notes'
    const rows = transactions.map(t =>
      `${t.date},"${t.particulars}",${t.amount},${t.category},${t.mode},"${t.notes}"`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'paisa-tracker-export.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  const shareSnapshot = () => {
    const data = { transactions, settings }
    const encoded = btoa(JSON.stringify(data))
    const url = `${window.location.origin}?snapshot=${encoded}`
    navigator.clipboard.writeText(url)
    toast.success('Snapshot URL copied to clipboard')
  }

  // Get per-category totals for reference grid
  const catTotals = new Map<string, number>()
  transactions.forEach(t => catTotals.set(t.category, (catTotals.get(t.category) || 0) + t.amount))

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="max-w-2xl"
    >
      <h1 className="text-display text-2xl font-bold text-foreground mb-6">Settings</h1>

      {/* Budget */}
      <section className="card-base p-5 mb-4">
        <h2 className="text-display text-base font-semibold text-foreground mb-4">Budget</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label htmlFor="stipend" className="text-xs text-muted-foreground mb-1 block">Monthly Stipend (₹)</label>
            <input
              id="stipend"
              type="number"
              value={stipend}
              onChange={e => setStipend(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label htmlFor="extra" className="text-xs text-muted-foreground mb-1 block">Extra Income (₹)</label>
            <input
              id="extra"
              type="number"
              value={extra}
              onChange={e => setExtra(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
        </div>
        <button onClick={handleSave} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Save Budget
        </button>
      </section>

      {/* Appearance */}
      <section className="card-base p-5 mb-4">
        <h2 className="text-display text-base font-semibold text-foreground mb-4">Appearance</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">Theme</span>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
            className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm text-foreground transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </section>

      {/* Data */}
      <section className="card-base p-5 mb-4">
        <h2 className="text-display text-base font-semibold text-foreground mb-4">Data</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={shareSnapshot} className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
            <Copy className="h-4 w-4" /> Share Snapshot
          </button>
        </div>
      </section>

      {/* Categories */}
      <section className="card-base p-5">
        <h2 className="text-display text-base font-semibold text-foreground mb-4">Categories Reference</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CATEGORIES.map(cat => (
            <div key={cat} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ background: CATEGORY_HEX[cat] }} />
                <span className="text-sm text-foreground">{cat}</span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">{formatCurrency(catTotals.get(cat) || 0)}</span>
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  )
}
