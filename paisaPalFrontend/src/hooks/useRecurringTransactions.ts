import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  confirmDetectedRecurring,
  createRecurringTransaction,
  deleteRecurringTransaction,
  detectRecurringTransactions,
  fetchRecurringTransactions,
  markRecurringPaid,
  updateRecurringTransaction,
  type ApiDetectedRecurring,
  type ApiRecurringTransaction,
  type RecurringTransactionCreateBody,
} from '@/lib/api'
import { formatToastMessage, getUserError } from '@/lib/userError'
import type { DetectedRecurring, RecurringStatus, RecurringTransaction } from '@/types'
import { useStore } from '@/store'

function mapRecurring(r: ApiRecurringTransaction): RecurringTransaction {
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

function mapDetected(d: ApiDetectedRecurring): DetectedRecurring {
  return {
    name: d.name,
    amount: d.amount,
    category: d.category,
    frequency: d.frequency,
    confidence: d.confidence,
    occurrences: d.occurrences,
    avgGapDays: d.avgGapDays,
    lastSeen: d.lastSeen,
    suggestedNextDate: d.suggestedNextDate,
    matchingTransactionIds: d.matchingTransactionIds,
  }
}

export function useRecurringTransactions(status: RecurringStatus = 'active') {
  const {
    recurringTransactions,
    setRecurringTransactions,
    addRecurringTransaction,
    updateRecurringTransaction: updateInStore,
    removeRecurringTransaction,
    isSnapshotView,
  } = useStore()

  const [loading, setLoading] = useState(false)

  const items = useMemo(
    () => recurringTransactions.filter((r) => r.status === status),
    [recurringTransactions, status],
  )

  const refresh = useCallback(async () => {
    if (isSnapshotView) return
    try {
      setLoading(true)
      const list = await fetchRecurringTransactions(status)
      setRecurringTransactions(list.map(mapRecurring))
    } catch (err) {
      const u = getUserError(err, 'Failed to load recurring transactions')
      toast.error(formatToastMessage(u))
    } finally {
      setLoading(false)
    }
  }, [isSnapshotView, setRecurringTransactions, status])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(async (body: RecurringTransactionCreateBody) => {
    if (isSnapshotView) return
    try {
      const created = await createRecurringTransaction(body)
      addRecurringTransaction(mapRecurring(created))
      toast.success('Recurring transaction created')
    } catch (err) {
      const u = getUserError(err, 'Failed to create recurring')
      toast.error(formatToastMessage(u))
    }
  }, [addRecurringTransaction, isSnapshotView])

  const update = useCallback(async (id: string, body: Partial<RecurringTransactionCreateBody>) => {
    if (isSnapshotView) return
    try {
      const updated = await updateRecurringTransaction(id, body)
      updateInStore(id, mapRecurring(updated))
      toast.success('Recurring updated')
    } catch (err) {
      const u = getUserError(err, 'Failed to update recurring')
      toast.error(formatToastMessage(u))
    }
  }, [isSnapshotView, updateInStore])

  const remove = useCallback(async (id: string) => {
    if (isSnapshotView) return
    try {
      await deleteRecurringTransaction(id)
      removeRecurringTransaction(id)
      toast.success('Recurring ended')
    } catch (err) {
      const u = getUserError(err, 'Failed to delete recurring')
      toast.error(formatToastMessage(u))
    }
  }, [isSnapshotView, removeRecurringTransaction])

  const markPaid = useCallback(async (id: string, body?: { date?: string; amount?: number }) => {
    if (isSnapshotView) return null
    try {
      const result = await markRecurringPaid(id, body)
      updateInStore(id, mapRecurring(result.recurring))
      toast.success('Marked as paid')
      return result
    } catch (err) {
      const u = getUserError(err, 'Failed to mark paid')
      toast.error(formatToastMessage(u))
      return null
    }
  }, [isSnapshotView, updateInStore])

  const detect = useCallback(async (): Promise<DetectedRecurring[]> => {
    if (isSnapshotView) return []
    try {
      const suggestions = await detectRecurringTransactions()
      return suggestions.map(mapDetected)
    } catch (err) {
      const u = getUserError(err, 'Failed to detect recurring')
      toast.error(formatToastMessage(u))
      return []
    }
  }, [isSnapshotView])

  const confirm = useCallback(async (suggestions: DetectedRecurring[]) => {
    if (isSnapshotView) return
    try {
      await confirmDetectedRecurring(
        suggestions.map((s) => ({
          name: s.name,
          amount: s.amount,
          category: s.category,
          frequency: s.frequency,
          suggestedNextDate: s.suggestedNextDate,
        })),
      )
      toast.success('Recurring suggestions confirmed')
      void refresh()
    } catch (err) {
      const u = getUserError(err, 'Failed to confirm suggestions')
      toast.error(formatToastMessage(u))
    }
  }, [isSnapshotView, refresh])

  return { items, loading, refresh, create, update, remove, markPaid, detect, confirm }
}
