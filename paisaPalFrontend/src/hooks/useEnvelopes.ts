import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  createEnvelope,
  fetchEnvelope,
  handleEnvelopeSurplus,
  updateEnvelope,
  type ApiEnvelope,
} from '@/lib/api'
import { formatToastMessage, getUserError } from '@/lib/userError'
import type { Envelope } from '@/types'
import { useStore } from '@/store'

function mapEnvelope(e: ApiEnvelope): Envelope {
  return {
    _id: e._id,
    month: e.month,
    envelopes: e.envelopes.map((it) => ({
      category: it.category,
      limit: it.limit,
      spent: it.spent,
      status: it.status,
      percentUsed: it.limit <= 0 ? 0 : Math.round((it.spent / it.limit) * 100),
      remaining: it.limit - it.spent,
    })),
    surplusAmount: e.surplusAmount,
    surplusAction: e.surplusAction,
    savingsGoalId: e.savingsGoalId,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}

export function useEnvelopes(month: string) {
  const { envelopes, setEnvelopes, isSnapshotView } = useStore()
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (isSnapshotView) return
    try {
      setLoading(true)
      const env = await fetchEnvelope(month)
      setEnvelopes(mapEnvelope(env))
    } catch (err) {
      const u = getUserError(err, 'Failed to load envelopes')
      toast.error(formatToastMessage(u))
    } finally {
      setLoading(false)
    }
  }, [isSnapshotView, month, setEnvelopes])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setup = useCallback(async (payload: { month: string; envelopes: Array<{ category: string; limit: number }> }) => {
    if (isSnapshotView) return
    try {
      const created = await createEnvelope(payload)
      setEnvelopes(mapEnvelope(created))
      toast.success('Envelopes created')
    } catch (err) {
      const u = getUserError(err, 'Failed to create envelopes')
      toast.error(formatToastMessage(u))
    }
  }, [isSnapshotView, setEnvelopes])

  const updateLimits = useCallback(async (items: Array<{ category: string; limit: number }>) => {
    if (isSnapshotView) return
    try {
      const updated = await updateEnvelope(month, { envelopes: items })
      setEnvelopes(mapEnvelope(updated))
      toast.success('Envelope limits updated')
    } catch (err) {
      const u = getUserError(err, 'Failed to update envelopes')
      toast.error(formatToastMessage(u))
    }
  }, [isSnapshotView, month, setEnvelopes])

  const surplus = useCallback(async (body: { action: 'save' | 'split' | 'carry'; goalId?: string }) => {
    if (isSnapshotView) return
    try {
      await handleEnvelopeSurplus(month, body)
      toast.success('Surplus recorded')
      void refresh()
    } catch (err) {
      const u = getUserError(err, 'Failed to handle surplus')
      toast.error(formatToastMessage(u))
    }
  }, [isSnapshotView, month, refresh])

  return { envelope: envelopes?.month === month ? envelopes : null, loading, refresh, setup, updateLimits, surplus }
}
