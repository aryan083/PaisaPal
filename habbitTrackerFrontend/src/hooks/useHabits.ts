import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { habitsApi } from '@/api'
import { useStore } from '@/store'
import type { Habit, HabitInput, HabitLogInput, HabitLogResponse } from '@/types'
import { getTodayString, isHabitScheduledForDate } from '@/lib/habitUtils'

export function useHabits() {
  const { habits, setHabits, addHabit, updateHabit: updateHabitInStore, updateHabitTodayLog } = useStore()
  const [isLoading, setIsLoading] = useState(false)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await habitsApi.list({ includeToday: 'true' })
      if (res.data) setHabits(res.data)
    } finally {
      setIsLoading(false)
    }
  }, [setHabits])

  useEffect(() => {
    if (habits.length === 0) {
      void refetch()
    }
  }, [])

  const today = getTodayString()
  const todayHabits = habits.filter((h) => !h.isArchived && isHabitScheduledForDate(h, today))

  const create = useCallback(async (input: HabitInput): Promise<Habit> => {
    const res = await habitsApi.create(input)
    if (!res.data || res.error) throw new Error(res.error ?? 'Failed to create habit')
    addHabit(res.data)
    return res.data
  }, [addHabit])

  const update = useCallback(async (id: string, input: Partial<HabitInput>): Promise<Habit> => {
    const res = await habitsApi.update(id, input)
    if (!res.data || res.error) throw new Error(res.error ?? 'Failed to update habit')
    updateHabitInStore(id, res.data)
    return res.data
  }, [updateHabitInStore])

  const archive = useCallback(async (id: string): Promise<void> => {
    const res = await habitsApi.archive(id)
    if (res.error) throw new Error(res.error)
    updateHabitInStore(id, { ...habits.find((h) => h._id === id)!, isArchived: true })
  }, [habits, updateHabitInStore])

  const logHabit = useCallback(async (
    id: string,
    input: HabitLogInput,
  ): Promise<HabitLogResponse> => {
    const habit = habits.find((h) => h._id === id)

    // Optimistic update
    if (habit) {
      const optimisticLog = {
        _id: 'temp',
        habitId: id,
        date: input.date,
        completed: input.completed,
        value: input.value ?? 0,
        loggedAt: new Date().toISOString(),
      }
      updateHabitTodayLog(id, optimisticLog, {
        ...habit,
        totalCompletions: input.completed ? habit.totalCompletions + 1 : habit.totalCompletions,
      })
    }

    const res = await habitsApi.log(id, input)
    if (!res.data || res.error) {
      // Rollback
      if (habit) updateHabitTodayLog(id, habit.todayLog!, habit)
      throw new Error(res.error ?? 'Failed to log habit')
    }

    // Apply real data
    updateHabitTodayLog(id, res.data.log, res.data.habit)

    if (res.data.xpAwarded > 0 && input.completed) {
      toast.success(`✅ ${habit?.name ?? 'Habit'} done! +${res.data.xpAwarded} XP`, {
        duration: 3000,
      })
    }

    if (res.data.newBadges && res.data.newBadges.length > 0) {
      res.data.newBadges.forEach((badge) => {
        toast.success(`🏆 Badge unlocked!`, { description: badge.badgeType, duration: 4000 })
      })
    }

    return res.data
  }, [habits, updateHabitTodayLog])

  return {
    habits,
    todayHabits,
    isLoading,
    create,
    update,
    archive,
    logHabit,
    refetch,
  }
}
