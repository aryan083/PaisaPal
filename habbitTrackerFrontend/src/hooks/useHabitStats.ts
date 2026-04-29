import { useCallback, useEffect, useState } from 'react'
import { habitsApi } from '@/api'
import { useStore } from '@/store'
import type { HabitStats } from '@/types'

export function useHabitStats() {
  const { habitStats, setHabitStats } = useStore()
  const [isLoading, setIsLoading] = useState(false)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await habitsApi.getStats()
      if (res.data) setHabitStats(res.data)
    } finally {
      setIsLoading(false)
    }
  }, [setHabitStats])

  useEffect(() => {
    void refetch()
  }, [])

  return { stats: habitStats, isLoading, refetch }
}
