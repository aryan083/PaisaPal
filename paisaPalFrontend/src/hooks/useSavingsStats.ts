import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { fetchSavingsStats, type ApiSavingsStats, type ApiRecurringTransaction } from '@/lib/api'
import { formatToastMessage, getUserError } from '@/lib/userError'
import type { RecurringTransaction, SavingsStats } from '@/types'
import { useStore } from '@/store'

function mapUpcoming(r: ApiRecurringTransaction): RecurringTransaction {
  return {
    _id: r._id,
    name: r.name,
    amount: r.amount,
    category: r.category,
    mode: r.mode,
    notes: r.notes,
    frequency: r.frequency,
    startDate: r.startDate,
    endDate: r.endDate,
    lastPaidDate: r.lastPaidDate,
    nextDueDate: r.nextDueDate,
    status: r.status,
    autoDetected: r.autoDetected,
    occurrences: r.occurrences,
    totalPaid: r.totalPaid,
    daysUntilDue: r.daysUntilDue,
    projectedMonthly: r.projectedMonthly,
    projectedYearly: r.projectedYearly,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

function mapStats(s: ApiSavingsStats): SavingsStats {
  return {
    totalSaved: s.totalSaved,
    activeGoals: s.activeGoals,
    completedGoals: s.completedGoals,
    savingsRate: s.savingsRate,
    monthlyRecurringCost: s.monthlyRecurringCost,
    upcomingDue: (s.upcomingDue as any[]).map((u) => mapUpcoming(u as ApiRecurringTransaction)),
    noSpendDays: s.noSpendDays,
    noSpendStreak: s.noSpendStreak,
    bestStreak: s.bestStreak,
    rapidoTaxSaved: s.rapidoTaxSaved,
  }
}

export function useSavingsStats() {
  const { savingsStats, setSavingsStats, isSnapshotView } = useStore()
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (isSnapshotView) return
    try {
      setLoading(true)
      const stats = await fetchSavingsStats()
      setSavingsStats(mapStats(stats))
    } catch (err) {
      const u = getUserError(err, 'Failed to load savings stats')
      toast.error(formatToastMessage(u))
    } finally {
      setLoading(false)
    }
  }, [isSnapshotView, setSavingsStats])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { stats: savingsStats, loading, refresh }
}
