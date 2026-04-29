import { addDays, format, getDay, parseISO } from 'date-fns'
import type { IHabitLog } from '../models/HabitLog'

/** Returns YYYY-MM-DD strings for every date the habit is expected. */
export function getExpectedDates(
  frequency: string,
  customDays: number[],
  from: string,
  to: string,
): string[] {
  const results: string[] = []
  let current = parseISO(from)
  const end = parseISO(to)

  while (current <= end) {
    const dow = getDay(current) // 0=Sun, 6=Sat
    const dateStr = format(current, 'yyyy-MM-dd')

    if (frequency === 'daily') {
      results.push(dateStr)
    } else if (frequency === 'weekdays') {
      if (dow >= 1 && dow <= 5) results.push(dateStr)
    } else if (frequency === 'weekends') {
      if (dow === 0 || dow === 6) results.push(dateStr)
    } else if (frequency === 'custom') {
      if (customDays.includes(dow)) results.push(dateStr)
    }

    current = addDays(current, 1)
  }

  return results
}

/** Walk backwards from asOfDate through expected dates, counting consecutive completions. */
export function calculateCurrentStreak(
  logs: IHabitLog[],
  frequency: string,
  customDays: number[],
  asOfDate: string,
): number {
  const completedSet = new Set(
    logs.filter((l) => l.completed).map((l) => l.date),
  )

  // Compute expected dates from 400 days ago to today
  const start = format(addDays(parseISO(asOfDate), -400), 'yyyy-MM-dd')
  const expected = getExpectedDates(frequency, customDays, start, asOfDate)

  // Walk backwards
  let streak = 0
  for (let i = expected.length - 1; i >= 0; i--) {
    if (completedSet.has(expected[i])) {
      streak++
    } else {
      break
    }
  }
  return streak
}

/** Walk the full log history to find the maximum consecutive streak. */
export function calculateLongestStreak(
  logs: IHabitLog[],
  frequency: string,
  customDays: number[],
): number {
  if (logs.length === 0) return 0

  const completedSet = new Set(
    logs.filter((l) => l.completed).map((l) => l.date),
  )

  const allDates = logs.map((l) => l.date).sort()
  if (allDates.length === 0) return 0

  const from = allDates[0]
  const to = allDates[allDates.length - 1]
  const expected = getExpectedDates(frequency, customDays, from, to)

  let longest = 0
  let current = 0
  for (const d of expected) {
    if (completedSet.has(d)) {
      current++
      if (current > longest) longest = current
    } else {
      current = 0
    }
  }
  return longest
}

/** Returns YYYY-MM-DD dates where a streak broke. */
export function getBreakPoints(
  logs: IHabitLog[],
  frequency: string,
  customDays: number[],
): string[] {
  if (logs.length === 0) return []

  const completedSet = new Set(
    logs.filter((l) => l.completed).map((l) => l.date),
  )

  const allDates = logs.map((l) => l.date).sort()
  const from = allDates[0]
  const to = allDates[allDates.length - 1]
  const expected = getExpectedDates(frequency, customDays, from, to)

  const breaks: string[] = []
  let prevCompleted = false

  for (const d of expected) {
    const completed = completedSet.has(d)
    if (!completed && prevCompleted) {
      breaks.push(d)
    }
    prevCompleted = completed
  }

  return breaks
}

/** Predict whether the current streak is at risk of breaking based on history. */
export function predictStreakRisk(
  logs: IHabitLog[],
  currentStreak: number,
  frequency: string,
  customDays: number[],
): {
  riskLevel: 'low' | 'medium' | 'high'
  reason: string
  historicalBreakPoint: number | null
} {
  const breaks = getBreakPoints(logs, frequency, customDays)
  if (breaks.length < 2) {
    return {
      riskLevel: 'low',
      reason: 'Not enough history to predict.',
      historicalBreakPoint: null,
    }
  }

  // Compute streak lengths at each break point
  const completedSet = new Set(
    logs.filter((l) => l.completed).map((l) => l.date),
  )
  const allDates = logs.map((l) => l.date).sort()
  if (allDates.length === 0) {
    return { riskLevel: 'low', reason: 'No data.', historicalBreakPoint: null }
  }

  const expected = getExpectedDates(frequency, customDays, allDates[0], allDates[allDates.length - 1])

  const streakLengths: number[] = []
  let cur = 0
  for (const d of expected) {
    if (completedSet.has(d)) {
      cur++
    } else if (cur > 0) {
      streakLengths.push(cur)
      cur = 0
    }
  }

  if (streakLengths.length === 0) {
    return { riskLevel: 'low', reason: 'No past streaks.', historicalBreakPoint: null }
  }

  const mostCommon = streakLengths
    .reduce<Map<number, number>>((acc, v) => {
      acc.set(v, (acc.get(v) ?? 0) + 1)
      return acc
    }, new Map())

  let maxCount = 0
  let historicalBreakPoint = 0
  for (const [len, count] of mostCommon) {
    if (count > maxCount) { maxCount = count; historicalBreakPoint = len }
  }

  const avg = streakLengths.reduce((a, b) => a + b, 0) / streakLengths.length

  if (Math.abs(currentStreak - historicalBreakPoint) <= 2) {
    return {
      riskLevel: 'high',
      reason: `You've broken this habit at day ${historicalBreakPoint} before (${maxCount} times).`,
      historicalBreakPoint,
    }
  } else if (Math.abs(currentStreak - avg) <= 3) {
    return {
      riskLevel: 'medium',
      reason: `You're approaching your average streak length of ${Math.round(avg)} days.`,
      historicalBreakPoint,
    }
  }

  return {
    riskLevel: 'low',
    reason: 'Streak looks healthy based on your history.',
    historicalBreakPoint,
  }
}

/** Returns consistency %, clamped 0-100, rounded to 1 decimal. */
export function getConsistencyScore(
  logs: IHabitLog[],
  frequency: string,
  customDays: number[],
  lookbackDays: number,
): number {
  const today = format(new Date(), 'yyyy-MM-dd')
  const from = format(addDays(new Date(), -lookbackDays + 1), 'yyyy-MM-dd')

  const expected = getExpectedDates(frequency, customDays, from, today)
  if (expected.length === 0) return 0

  const completedSet = new Set(
    logs.filter((l) => l.completed && l.date >= from && l.date <= today).map((l) => l.date),
  )

  const done = expected.filter((d) => completedSet.has(d)).length
  const score = (done / expected.length) * 100
  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10
}
