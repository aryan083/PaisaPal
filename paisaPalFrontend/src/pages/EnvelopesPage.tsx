import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Wallet, ChevronLeft, ChevronRight, Plus, BarChart3, TrendingUp, PieChart as PieChartIcon, Gauge, Lightbulb, AlertTriangle, Target, PiggyBank, Activity, TrendingDown, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatCurrency, cn, toLocalDateKey } from '@/lib/utils'
import { useEnvelopes } from '@/hooks/useEnvelopes'
import { getAvailableCategories } from '@/types'
import { useStore } from '@/store'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts'

function getMonthKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return getMonthKey(date)
}

export function EnvelopesPage() {
  const { settings, isSnapshotView } = useStore()
  const [month, setMonth] = useState(getMonthKey(new Date()))
  const { envelope, loading, setup, updateLimits, surplus } = useEnvelopes(month)

  const categories = getAvailableCategories(settings)

  const [setupOpen, setSetupOpen] = useState(false)
  const [limits, setLimits] = useState<Record<string, string>>({})

  const totalBudgeted = useMemo(() => envelope?.envelopes.reduce((s, e) => s + e.limit, 0) ?? 0, [envelope])
  const totalSpent = useMemo(() => envelope?.envelopes.reduce((s, e) => s + e.spent, 0) ?? 0, [envelope])
  const remaining = totalBudgeted - totalSpent

  const openSetup = () => {
    const next: Record<string, string> = {}
    for (const c of categories) {
      next[c] = String(envelope?.envelopes.find((e) => e.category === c)?.limit ?? 0)
    }
    setLimits(next)
    setSetupOpen(true)
  }

  const submitSetup = async () => {
    const items = Object.entries(limits).map(([category, limit]) => ({
      category,
      limit: Math.max(0, Number(limit) || 0),
    }))

    if (!envelope || envelope.envelopes.length === 0) {
      await setup({ month, envelopes: items })
    } else {
      await updateLimits(items)
    }

    setSetupOpen(false)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h1 className="text-display text-2xl font-bold text-foreground">Envelopes</h1>
        </div>
        <button
          onClick={openSetup}
          disabled={isSnapshotView}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Edit Limits
        </button>
      </div>

      <div className="card-base p-5 mb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className="rounded-xl bg-secondary p-2 text-foreground"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-display text-base font-semibold text-foreground">{month}</div>
        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="rounded-xl bg-secondary p-2 text-foreground"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(envelope?.envelopes ?? []).map((e) => {
          const pct = e.limit <= 0 ? 0 : Math.round((e.spent / e.limit) * 100)
          const bar = Math.min(100, Math.max(0, pct))
          const statusColor = e.status === 'over' ? 'bg-red-500' : e.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
          return (
            <div key={e.category} className="card-base p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-display text-sm font-semibold text-foreground">{e.category}</div>
                <div className={cn(
                  'rounded-full px-2 py-1 text-[10px] font-semibold',
                  e.status === 'over'
                    ? 'bg-red-500/10 text-red-500'
                    : e.status === 'warning'
                      ? 'bg-yellow-500/10 text-yellow-500'
                      : 'bg-green-500/10 text-green-500',
                )}>
                  {e.status}
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Limit: {formatCurrency(e.limit)}</div>
              <div className="mt-3 h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div className={cn('h-full rounded-full', statusColor)} style={{ width: `${bar}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{formatCurrency(e.spent)} / {formatCurrency(e.limit)}</span>
                <span className="text-foreground font-semibold">{pct}%</span>
              </div>
              {e.limit - e.spent >= 0 ? (
                <div className="mt-2 text-xs text-muted-foreground">{formatCurrency(e.limit - e.spent)} left</div>
              ) : (
                <div className="mt-2 text-xs text-red-500">Overspent by {formatCurrency(Math.abs(e.limit - e.spent))}</div>
              )}
            </div>
          )
        })}

        {(!envelope || envelope.envelopes.length === 0) && (
          <div className="card-base p-10 text-center text-muted-foreground sm:col-span-2 lg:col-span-3">
            {loading ? 'Loading…' : 'No envelopes configured for this month. Click “Edit Limits” to set them up.'}
          </div>
        )}
      </div>

      <div className="card-base p-5 mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Total budgeted</div>
            <div className="text-display text-xl font-bold text-foreground">{formatCurrency(totalBudgeted)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total spent</div>
            <div className="text-display text-xl font-bold text-foreground">{formatCurrency(totalSpent)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Remaining</div>
            <div className={cn('text-display text-xl font-bold', remaining < 0 ? 'text-red-500' : 'text-foreground')}>
              {remaining < 0 ? `-${formatCurrency(Math.abs(remaining))}` : formatCurrency(remaining)}
            </div>
          </div>
        </div>

        {envelope && remaining > 0 && !isSnapshotView && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => void surplus({ action: 'carry' })}
              className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-foreground"
            >
              Carry surplus
            </button>
          </div>
        )}
      </div>

      {/* Budget Analytics Section */}
      {envelope && envelope.envelopes.length > 0 && (
        <>
          <h2 className="text-display text-xl font-bold text-foreground mb-4 mt-8 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Budget Analytics
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Budget vs Spent Bar Chart */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card-base p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-display text-sm font-semibold text-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  Budget vs Spent by Category
                </h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={envelope.envelopes.map(e => ({
                    category: e.category.slice(0, 12),
                    limit: e.limit,
                    spent: e.spent,
                    remaining: Math.max(0, e.limit - e.spent)
                  }))} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="limit" fill="#22d47a" name="Budget" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="spent" fill="#ff6b35" name="Spent" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Category Spending Distribution */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card-base p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-display text-sm font-semibold text-foreground flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-primary" />
                  Spending Distribution
                </h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={envelope.envelopes
                        .filter(e => e.spent > 0)
                        .sort((a, b) => b.spent - a.spent)
                        .slice(0, 6)
                        .map(e => ({ name: e.category, value: e.spent }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {envelope.envelopes.filter(e => e.spent > 0).slice(0, 6).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={['#22d47a', '#ff6b35', '#4da6ff', '#b06aff', '#ffaa2b', '#ff4f6a'][index % 6]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Envelope Utilization Gauge */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-base p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-display text-sm font-semibold text-foreground flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" />
                  Envelope Health
                </h3>
              </div>
              <div className="space-y-3">
                {envelope.envelopes.slice(0, 6).map((env) => {
                  const pct = env.limit > 0 ? Math.round((env.spent / env.limit) * 100) : 0
                  const color = pct > 100 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22d47a'
                  return (
                    <div key={env.category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{env.category}</span>
                        <span className="text-foreground font-medium">{pct}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(pct, 100)}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatCurrency(env.spent)}</span>
                        <span>{formatCurrency(env.limit)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>

            {/* Category Status Breakdown */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card-base p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-display text-sm font-semibold text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Status Overview
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm text-foreground">Under Budget</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {envelope.envelopes.filter(e => e.status === 'under').length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-yellow-500/10">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-sm text-foreground">Warning (80%+)</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {envelope.envelopes.filter(e => e.status === 'warning').length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/10">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm text-foreground">Over Budget</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {envelope.envelopes.filter(e => e.status === 'over').length}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Budget Insights Grid */}
          <h2 className="text-display text-xl font-bold text-foreground mb-4 mt-8 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Budget Insights
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Budget Utilization % */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card-base p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-display text-xs font-semibold text-foreground">Utilization</span>
              </div>
              <div className="text-display text-xl font-bold text-foreground">
                {Math.round((totalSpent / Math.max(1, totalBudgeted)) * 100)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {formatCurrency(totalSpent)} of {formatCurrency(totalBudgeted)}
              </div>
            </motion.div>

            {/* Overspent Categories */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card-base p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-display text-xs font-semibold text-foreground">Over Budget</span>
              </div>
              <div className="text-display text-xl font-bold text-foreground">
                {envelope.envelopes.filter(e => e.status === 'over').length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                categories exceeded limit
              </div>
              {envelope.envelopes.filter(e => e.status === 'over').length > 0 && (
                <p className="text-xs text-red-500 mt-2">
                  {envelope.envelopes.filter(e => e.status === 'over').map(e => e.category).slice(0, 2).join(', ')}
                  {envelope.envelopes.filter(e => e.status === 'over').length > 2 && '...'}
                </p>
              )}
            </motion.div>

            {/* Warning Categories */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-base p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-yellow-500" />
                <span className="text-display text-xs font-semibold text-foreground">Near Limit</span>
              </div>
              <div className="text-display text-xl font-bold text-foreground">
                {envelope.envelopes.filter(e => e.status === 'warning').length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                categories at 80%+ of limit
              </div>
            </motion.div>

            {/* Daily Burn Rate */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card-base p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-orange-500" />
                <span className="text-display text-xs font-semibold text-foreground">Daily Burn</span>
              </div>
              {(() => {
                const daysElapsed = Math.max(1, new Date().getDate())
                const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
                const dailyBurn = Math.round(totalSpent / daysElapsed)
                const targetDaily = Math.round(totalBudgeted / daysInMonth)
                return (
                  <>
                    <div className="text-display text-xl font-bold text-foreground">
                      {formatCurrency(dailyBurn)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      target: {formatCurrency(targetDaily)}/day
                    </div>
                    {dailyBurn > targetDaily ? (
                      <p className="text-xs text-red-500 mt-2">⚠️ Above target</p>
                    ) : (
                      <p className="text-xs text-green-500 mt-2">✅ On track</p>
                    )}
                  </>
                )
              })()}
            </motion.div>

            {/* Highest Overspend */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-base p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-display text-xs font-semibold text-foreground">Highest Overspend</span>
              </div>
              {(() => {
                const overspent = envelope.envelopes
                  .filter(e => e.spent > e.limit)
                  .sort((a, b) => (b.spent - b.limit) - (a.spent - a.limit))[0]
                if (!overspent) return (
                  <>
                    <div className="text-foreground font-semibold text-sm">None</div>
                    <div className="text-xs text-muted-foreground mt-1">All within budget 🎉</div>
                  </>
                )
                const overBy = overspent.spent - overspent.limit
                const pctOver = Math.round((overBy / overspent.limit) * 100)
                return (
                  <>
                    <div className="text-foreground font-semibold text-sm">{overspent.category}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(overBy)} over ({pctOver}%)
                    </div>
                  </>
                )
              })()}
            </motion.div>

            {/* Savings Opportunity */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card-base p-4">
              <div className="flex items-center gap-2 mb-2">
                <PiggyBank className="h-4 w-4 text-green-500" />
                <span className="text-display text-xs font-semibold text-foreground">Savings Opportunity</span>
              </div>
              {(() => {
                const underBudget = envelope.envelopes.filter(e => e.spent < e.limit * 0.5)
                const potentialSavings = underBudget.reduce((s, e) => s + Math.round(e.limit * 0.5 - e.spent), 0)
                return (
                  <>
                    <div className="text-display text-xl font-bold text-foreground">
                      {formatCurrency(potentialSavings)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      from {underBudget.length} underutilized categories
                    </div>
                  </>
                )
              })()}
            </motion.div>

            {/* Projected Month-End */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-base p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="text-display text-xs font-semibold text-foreground">Projected Spend</span>
              </div>
              {(() => {
                const daysElapsed = Math.max(1, new Date().getDate())
                const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
                const projected = Math.round((totalSpent / daysElapsed) * daysInMonth)
                const variance = projected - totalBudgeted
                return (
                  <>
                    <div className="text-display text-xl font-bold text-foreground">
                      {formatCurrency(projected)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      vs {formatCurrency(totalBudgeted)} budget
                    </div>
                    {variance > 0 ? (
                      <p className="text-xs text-red-500 mt-2">⚠️ {formatCurrency(variance)} over</p>
                    ) : (
                      <p className="text-xs text-green-500 mt-2">✅ {formatCurrency(Math.abs(variance))} under</p>
                    )}
                  </>
                )
              })()}
            </motion.div>

            {/* Smart Adjustments */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="card-base p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-purple-500" />
                <span className="text-display text-xs font-semibold text-foreground">Smart Adjustments</span>
              </div>
              {(() => {
                const overSpent = envelope.envelopes.filter(e => e.spent > e.limit)
                const underSpent = envelope.envelopes.filter(e => e.spent < e.limit * 0.5)
                if (overSpent.length === 0) return (
                  <>
                    <div className="text-foreground font-semibold text-sm">Great job!</div>
                    <div className="text-xs text-muted-foreground mt-1">No adjustments needed</div>
                  </>
                )
                const recommendIncrease = overSpent[0]
                return (
                  <>
                    <div className="text-foreground font-semibold text-sm">
                      +{formatCurrency(Math.round((recommendIncrease.spent - recommendIncrease.limit) * 1.2))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      for {recommendIncrease.category}
                    </div>
                    {underSpent.length > 0 && (
                      <div className="text-xs text-green-500 mt-2">
                        Reallocate from {underSpent[0].category}
                      </div>
                    )}
                  </>
                )
              })()}
            </motion.div>
          </div>
        </>
      )}

      <Sheet open={setupOpen} onOpenChange={setSetupOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Envelope Limits · {month}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {categories.map((c) => (
              <div key={c} className="flex items-center justify-between gap-3">
                <div className="text-sm text-foreground">{c}</div>
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  value={limits[c] ?? '0'}
                  onChange={(e) => {
                    const val = e.target.value
                    const num = val === '' ? 0 : Math.max(0, Math.min(1000000, Number(val)))
                    setLimits((s) => ({ ...s, [c]: String(num) }))
                  }}
                  className="w-32 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            ))}
            <button
              onClick={() => void submitSetup()}
              disabled={isSnapshotView}
              className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  )
}
