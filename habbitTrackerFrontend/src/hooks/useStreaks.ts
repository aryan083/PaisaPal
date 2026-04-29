import { useMemo } from 'react'
import { useStore } from '@/store'
import type { Habit } from '@/types'

export function useStreaks() {
  const habits = useStore((s) => s.habits)

  const byHabit = useMemo(() =>
    habits
      .filter((h) => !h.isArchived)
      .map((h) => ({
        habitId: h._id,
        name: h.name,
        icon: h.icon,
        current: h.currentStreak,
        longest: h.longestStreak,
      }))
      .sort((a, b) => b.current - a.current),
    [habits],
  )

  const best = useMemo((): { habit: Habit; days: number } | null => {
    const top = habits.filter((h) => !h.isArchived)
      .sort((a, b) => b.currentStreak - a.currentStreak)[0]
    return top ? { habit: top, days: top.currentStreak } : null
  }, [habits])

  const atRisk = useMemo(() =>
    habits.filter((h) =>
      !h.isArchived &&
      h.streakRisk &&
      (h.streakRisk.riskLevel === 'high' || h.streakRisk.riskLevel === 'medium'),
    ),
    [habits],
  )

  return { byHabit, best, atRisk }
}
