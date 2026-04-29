import { useCallback, useEffect, useState } from 'react'
import { habitsApi } from '@/api'
import type { HabitLog } from '@/types'

export function useHabitLogs(habitId: string, from: string, to: string) {
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!habitId) return
    setIsLoading(true)
    try {
      const res = await habitsApi.getLogs(habitId, from, to)
      if (res.data) setLogs(res.data)
    } finally {
      setIsLoading(false)
    }
  }, [habitId, from, to])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { logs, isLoading, refetch }
}
