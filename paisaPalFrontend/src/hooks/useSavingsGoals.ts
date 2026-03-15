import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  contributeToGoal,
  createSavingsGoal,
  deleteSavingsGoal,
  fetchGoalHistory,
  fetchSavingsGoals,
  updateSavingsGoal,
  type ApiSavingsContribution,
  type ApiSavingsGoal,
  type SavingsContributionCreateBody,
  type SavingsGoalCreateBody,
  type SavingsGoalUpdateBody,
} from '@/lib/api'
import { formatToastMessage, getUserError } from '@/lib/userError'
import type { SavingsContribution, SavingsGoal } from '@/types'
import { useStore } from '@/store'

function mapGoal(g: ApiSavingsGoal): SavingsGoal {
  return {
    _id: g._id,
    name: g.name,
    emoji: g.emoji,
    targetAmount: g.targetAmount,
    savedAmount: g.savedAmount,
    monthlyTarget: g.monthlyTarget,
    deadline: g.deadline,
    status: g.status,
    color: g.color,
    progressPercent: g.progressPercent,
    monthsLeft: g.monthsLeft,
    monthlyNeeded: g.monthlyNeeded,
    eta: g.eta,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  }
}

function mapContribution(c: ApiSavingsContribution): SavingsContribution {
  return {
    _id: c._id,
    goalId: c.goalId,
    amount: c.amount,
    type: c.type,
    note: c.note,
    transactionId: c.transactionId,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

export function useSavingsGoals() {
  const {
    savingsGoals,
    setSavingsGoals,
    addSavingsGoal,
    updateSavingsGoal: updateGoalInStore,
    removeSavingsGoal,
    isSnapshotView,
  } = useStore()

  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (isSnapshotView) return
    try {
      setLoading(true)
      const goals = await fetchSavingsGoals()
      setSavingsGoals(goals.map(mapGoal))
    } catch (err) {
      const u = getUserError(err, 'Failed to load savings goals')
      toast.error(formatToastMessage(u))
    } finally {
      setLoading(false)
    }
  }, [isSnapshotView, setSavingsGoals])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(
    async (body: SavingsGoalCreateBody) => {
      if (isSnapshotView) return
      try {
        const created = await createSavingsGoal(body)
        addSavingsGoal(mapGoal(created))
        toast.success('Savings goal created')
      } catch (err) {
        const u = getUserError(err, 'Failed to create goal')
        toast.error(formatToastMessage(u))
      }
    },
    [addSavingsGoal, isSnapshotView],
  )

  const update = useCallback(
    async (id: string, body: SavingsGoalUpdateBody) => {
      if (isSnapshotView) return
      try {
        const updated = await updateSavingsGoal(id, body)
        updateGoalInStore(id, mapGoal(updated))
        toast.success('Goal updated')
      } catch (err) {
        const u = getUserError(err, 'Failed to update goal')
        toast.error(formatToastMessage(u))
      }
    },
    [isSnapshotView, updateGoalInStore],
  )

  const remove = useCallback(
    async (id: string) => {
      if (isSnapshotView) return
      try {
        await deleteSavingsGoal(id)
        removeSavingsGoal(id)
        toast.success('Goal removed')
      } catch (err) {
        const u = getUserError(err, 'Failed to delete goal')
        toast.error(formatToastMessage(u))
      }
    },
    [isSnapshotView, removeSavingsGoal],
  )

  const contribute = useCallback(
    async (goalId: string, body: SavingsContributionCreateBody) => {
      if (isSnapshotView) return
      try {
        const result = await contributeToGoal(goalId, body)
        updateGoalInStore(goalId, mapGoal(result.goal))
        toast.success('Contribution added')
        return mapContribution(result.contribution)
      } catch (err) {
        const u = getUserError(err, 'Failed to contribute')
        toast.error(formatToastMessage(u))
        return null
      }
    },
    [isSnapshotView, updateGoalInStore],
  )

  const history = useCallback(async (goalId: string): Promise<SavingsContribution[]> => {
    if (isSnapshotView) return []
    try {
      const items = await fetchGoalHistory(goalId)
      return items.map(mapContribution)
    } catch (err) {
      const u = getUserError(err, 'Failed to load history')
      toast.error(formatToastMessage(u))
      return []
    }
  }, [isSnapshotView])

  return {
    goals: savingsGoals,
    loading,
    refresh,
    create,
    update,
    remove,
    contribute,
    history,
  }
}
