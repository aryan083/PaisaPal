import { useStore } from '@/store'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'
import { PaymentModeSplit } from '@/components/dashboard/PaymentModeSplit'
import type { Stats } from '@/types'

type Props = {
  stats?: Stats | null
}

export function BudgetRing({ stats }: Props) {
  const { settings, updateSettings } = useStore()
  const totalSpent = stats?.totalSpent ?? 0
  const budget = settings.stipend + settings.extra
  const remaining = Math.max(0, budget - totalSpent)
  const pct = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0

  const [editing, setEditing] = useState(false)
  const [stipendVal, setStipendVal] = useState(String(settings.stipend))
  const [extraVal, setExtraVal] = useState(String(settings.extra))
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const ringColor = pct < 70 ? 'hsl(var(--success))' : pct < 90 ? 'hsl(var(--warning))' : 'hsl(var(--danger))'
  const ringBg = pct < 70 ? 'hsl(var(--success) / 0.15)' : pct < 90 ? 'hsl(var(--warning) / 0.15)' : 'hsl(var(--danger) / 0.15)'

  const radius = 90
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  const handleSave = () => {
    const s = parseInt(stipendVal) || 0
    const e = parseInt(extraVal) || 0
    updateSettings({ stipend: s, extra: e })
    setEditing(false)
  }

  useEffect(() => {
    if (editing) {
      return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
    }
  }, [editing])

  return (
    <div className="card-base p-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
        {/* Ring */}
        <div className="relative flex-shrink-0">
          <svg width="200" height="200" viewBox="0 0 200 200" className="rotate-[-90deg]">
            <circle cx="100" cy="100" r={radius} fill="none" stroke={ringBg} strokeWidth="12" />
            <motion.circle
              cx="100" cy="100" r={radius} fill="none"
              stroke={ringColor} strokeWidth="12" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-display text-3xl font-bold text-foreground">{formatCurrency(totalSpent)}</span>
            <button
              onClick={() => setEditing(!editing)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              of {formatCurrency(budget)}
            </button>
          </div>
        </div>

        {/* Stats + Edit */}
        <div className="flex flex-1 flex-col gap-3 w-full">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Spent', value: formatCurrency(totalSpent), color: 'text-foreground' },
              { label: 'Remaining', value: formatCurrency(remaining), color: pct < 70 ? 'text-[hsl(var(--success))]' : pct < 90 ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--danger))]' },
              { label: 'Budget', value: formatCurrency(budget), color: 'text-primary' },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-secondary px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-display text-sm font-semibold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {editing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex flex-col gap-2 rounded-xl bg-secondary p-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Stipend</label>
                  <input
                    type="number"
                    value={stipendVal}
                    onChange={e => setStipendVal(e.target.value)}
                    className="w-full rounded-lg bg-background px-3 py-1.5 text-sm text-foreground border border-border"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Extra Income</label>
                  <input
                    type="number"
                    value={extraVal}
                    onChange={e => setExtraVal(e.target.value)}
                    className="w-full rounded-lg bg-background px-3 py-1.5 text-sm text-foreground border border-border"
                  />
                </div>
              </div>
              <button
                onClick={handleSave}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
              >
                Save Budget
              </button>
            </motion.div>
          )}

          <div className="rounded-xl bg-secondary p-3">
            <PaymentModeSplit stats={stats} variant="embed" />
          </div>
        </div>
      </div>
    </div>
  )
}
