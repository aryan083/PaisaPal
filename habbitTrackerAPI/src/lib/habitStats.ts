import { format, addDays, parseISO, getDay } from 'date-fns'
import HabitLog from '../models/HabitLog'
import type { IHabit } from '../models/Habit'
import type { IHabitLog } from '../models/HabitLog'
import { getExpectedDates } from './streakEngine'

export interface HeatmapDay {
  date: string
  value: number
  completed: number
  total: number
}

export interface FailureAnalysis {
  worstDayOfWeek: number
  worstDayName: string
  failuresByDayOfWeek: {
    day: number
    dayName: string
    totalMissed: number
    totalExpected: number
    failureRate: number
  }[]
  hardestHabit: {
    habitId: string
    name: string
    icon: string
    difficultyScore: number
  } | null
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export async function getHeatmapData(
  userId: string,
  habits: IHabit[],
  days: number,
): Promise<HeatmapDay[]> {
  if (habits.length === 0) {
    const result: HeatmapDay[] = []
    for (let i = days - 1; i >= 0; i--) {
      result.push({ date: format(addDays(new Date(), -i), 'yyyy-MM-dd'), value: 0, completed: 0, total: 0 })
    }
    return result
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  const from = format(addDays(new Date(), -(days - 1)), 'yyyy-MM-dd')

  const logsByDate = await HabitLog.aggregate<{ _id: string; completed: number; total: number }>([
    { $match: { userId, date: { $gte: from, $lte: today } } },
    {
      $group: {
        _id: '$date',
        completed: { $sum: { $cond: ['$completed', 1, 0] } },
        total: { $sum: 1 },
      },
    },
  ])

  const logMap = new Map(logsByDate.map((l) => [l._id, l]))

  const result: HeatmapDay[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = format(addDays(new Date(), -i), 'yyyy-MM-dd')
    const dow = getDay(parseISO(d))

    const scheduledCount = habits.filter((h) => {
      if (h.frequency === 'daily') return true
      if (h.frequency === 'weekdays') return dow >= 1 && dow <= 5
      if (h.frequency === 'weekends') return dow === 0 || dow === 6
      if (h.frequency === 'custom') return (h.customDays ?? []).includes(dow)
      return false
    }).length

    const logEntry = logMap.get(d)
    const completed = logEntry?.completed ?? 0
    const value = scheduledCount === 0 ? 0 : Math.min(1, completed / scheduledCount)

    result.push({ date: d, value, completed, total: scheduledCount })
  }

  return result
}

export async function getFailureAnalysis(
  userId: string,
  habits: IHabit[],
): Promise<FailureAnalysis> {
  const today = format(new Date(), 'yyyy-MM-dd')
  const from = format(addDays(new Date(), -90), 'yyyy-MM-dd')

  const logs = await HabitLog.find({ userId, date: { $gte: from, $lte: today } }).lean()
  const completedSet = new Set(logs.filter((l) => l.completed).map((l) => l.date + '|' + l.habitId.toString()))
  const loggedSet = new Set(logs.map((l) => l.date + '|' + l.habitId.toString()))

  const byDow = new Array(7).fill(null).map((_, i) => ({
    day: i,
    dayName: DAY_NAMES[i],
    totalMissed: 0,
    totalExpected: 0,
    failureRate: 0,
  }))

  for (const habit of habits) {
    const expected = getExpectedDates(habit.frequency, habit.customDays ?? [], from, today)
    for (const d of expected) {
      const dow = getDay(parseISO(d))
      const key = d + '|' + habit._id.toString()
      byDow[dow].totalExpected++
      if (loggedSet.has(key) && !completedSet.has(key)) {
        byDow[dow].totalMissed++
      } else if (!completedSet.has(key)) {
        byDow[dow].totalMissed++
      }
    }
  }

  for (const d of byDow) {
    d.failureRate = d.totalExpected === 0 ? 0 : Math.round((d.totalMissed / d.totalExpected) * 100)
  }

  const worst = byDow.reduce((prev, curr) =>
    curr.totalExpected > 0 && curr.failureRate > prev.failureRate ? curr : prev,
    byDow[0],
  )

  // hardest habit by difficulty score
  let hardestHabit: FailureAnalysis['hardestHabit'] = null
  let maxScore = 0
  for (const habit of habits) {
    const habitLogs = logs.filter((l) => l.habitId.toString() === habit._id.toString())
    const expected = getExpectedDates(habit.frequency, habit.customDays ?? [], from, today)
    if (expected.length === 0) continue
    const done = new Set(habitLogs.filter((l) => l.completed).map((l) => l.date))
    const missed = expected.filter((d) => !done.has(d)).length
    const score = missed / expected.length
    if (score > maxScore) {
      maxScore = score
      hardestHabit = {
        habitId: habit._id.toString(),
        name: habit.name,
        icon: habit.icon,
        difficultyScore: Math.round(score * 100) / 100,
      }
    }
  }

  return {
    worstDayOfWeek: worst.day,
    worstDayName: worst.dayName,
    failuresByDayOfWeek: byDow,
    hardestHabit,
  }
}

export function getMovingAverage(
  data: { date: string; value: number }[],
  windowSize: number,
): { date: string; value: number }[] {
  return data.map((point, i) => {
    const start = Math.max(0, i - windowSize + 1)
    const window = data.slice(start, i + 1)
    const avg = window.reduce((sum, p) => sum + p.value, 0) / window.length
    return { date: point.date, value: Math.round(avg * 100) / 100 }
  })
}

export function computeDifficultyScore(
  habit: IHabit,
  recentLogs: IHabitLog[],
  frequency: string,
  customDays: number[],
  days: number,
): number {
  const today = format(new Date(), 'yyyy-MM-dd')
  const from = format(addDays(new Date(), -days), 'yyyy-MM-dd')
  const expected = getExpectedDates(frequency, customDays, from, today)
  if (expected.length === 0) return 0
  const done = new Set(recentLogs.filter((l) => l.completed).map((l) => l.date))
  const missed = expected.filter((d) => !done.has(d)).length
  return Math.round((missed / expected.length) * 100) / 100
}
