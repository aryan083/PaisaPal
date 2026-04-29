import { format, addDays, parseISO, getDay } from 'date-fns'
import Habit from '../models/Habit'
import HabitLog from '../models/HabitLog'
import Transaction from '../models/Transaction'
import HabitCategory from '../models/HabitCategory'
import { getExpectedDates, getBreakPoints } from './streakEngine'

export interface Insight {
  type: 'positive' | 'warning' | 'neutral'
  title: string
  description: string
  metric?: string
  actionable?: string
}

export async function generateHabitInsights(userId: string): Promise<Insight[]> {
  const insights: Insight[] = []
  const today = format(new Date(), 'yyyy-MM-dd')
  const ninetyDaysAgo = format(addDays(new Date(), -90), 'yyyy-MM-dd')
  const sixtyDaysAgo = format(addDays(new Date(), -60), 'yyyy-MM-dd')
  const thirtyDaysAgo = format(addDays(new Date(), -30), 'yyyy-MM-dd')
  const prevThirtyStart = format(addDays(new Date(), -60), 'yyyy-MM-dd')
  const prevThirtyEnd = format(addDays(new Date(), -31), 'yyyy-MM-dd')

  const [habits, recentLogs, recentTransactions, categories] = await Promise.all([
    Habit.find({ userId, isArchived: false }).lean(),
    HabitLog.find({ userId, date: { $gte: ninetyDaysAgo, $lte: today } }).lean(),
    Transaction.find({
      userId,
      ...(recentLogs[0] ? {} : {}), // avoid duplicate variable warning
    }).catch(() => []),
    HabitCategory.find({ userId }).lean(),
  ])

  // We need transactions separately:
  const transactions = await Transaction.find({
    userId,
    dateKey: { $gte: ninetyDaysAgo, $lte: today },
  }).lean().catch(() => [])

  if (habits.length === 0) return []

  // 1. WEEKDAY_WEEKEND_GAP
  try {
    const weekdayLogs = recentLogs.filter((l) => {
      const dow = getDay(parseISO(l.date))
      return dow >= 1 && dow <= 5
    })
    const weekendLogs = recentLogs.filter((l) => {
      const dow = getDay(parseISO(l.date))
      return dow === 0 || dow === 6
    })

    const weekdayRate = weekdayLogs.length === 0 ? 0 :
      (weekdayLogs.filter((l) => l.completed).length / weekdayLogs.length) * 100
    const weekendRate = weekendLogs.length === 0 ? 0 :
      (weekendLogs.filter((l) => l.completed).length / weekendLogs.length) * 100

    if (Math.abs(weekdayRate - weekendRate) > 20 && weekdayLogs.length >= 5 && weekendLogs.length >= 2) {
      insights.push({
        type: weekdayRate > weekendRate ? 'positive' : 'warning',
        title: weekdayRate > weekendRate ? "You're stronger on weekdays" : "Weekends are your weak spot",
        description: `Weekday completion: ${Math.round(weekdayRate)}% vs weekend: ${Math.round(weekendRate)}%`,
        actionable: 'Try scheduling lighter habits for weekends',
      })
    }
  } catch { /* skip */ }

  // 2. STREAK_BREAK_PATTERN
  try {
    for (const habit of habits) {
      const habitLogs = recentLogs.filter((l) => l.habitId.toString() === habit._id.toString())
      const breaks = getBreakPoints(habitLogs, habit.frequency, habit.customDays)
      if (breaks.length >= 2) {
        const expected = getExpectedDates(habit.frequency, habit.customDays, ninetyDaysAgo, today)
        const completedSet = new Set(habitLogs.filter((l) => l.completed).map((l) => l.date))

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

        if (streakLengths.length >= 2) {
          const count = streakLengths.reduce<Map<number, number>>((acc, v) => {
            acc.set(v, (acc.get(v) ?? 0) + 1)
            return acc
          }, new Map())

          let maxCnt = 0
          let breakAt = 0
          for (const [len, cnt] of count) {
            if (cnt > maxCnt) { maxCnt = cnt; breakAt = len }
          }

          if (maxCnt >= 2) {
            insights.push({
              type: 'warning',
              title: 'Streak danger zone approaching',
              description: `You've broken "${habit.name}" at day ${breakAt}, ${maxCnt} times in the past.`,
              metric: `Currently at day ${habit.currentStreak}`,
            })
          }
        }
      }
    }
  } catch { /* skip */ }

  // 3. CATEGORY_NEGLECT
  try {
    const sevenDaysAgo = format(addDays(new Date(), -7), 'yyyy-MM-dd')
    for (const cat of categories) {
      const catHabits = habits.filter((h) => h.categoryId.toString() === cat._id.toString())
      if (catHabits.length === 0) continue

      const catLogs7d = recentLogs.filter((l) =>
        l.date >= sevenDaysAgo &&
        catHabits.some((h) => h._id.toString() === l.habitId.toString()),
      )

      const catLogsLast30 = recentLogs.filter((l) =>
        l.date >= thirtyDaysAgo &&
        catHabits.some((h) => h._id.toString() === l.habitId.toString()),
      )

      if (catLogsLast30.length === 0) continue // no activity in 30d, skip

      const completionRate7d = catLogs7d.length === 0 ? 0 :
        (catLogs7d.filter((l) => l.completed).length / catLogs7d.length) * 100

      if (completionRate7d < 30) {
        insights.push({
          type: 'warning',
          title: `You're neglecting ${cat.name}`,
          description: `No ${cat.name} habits completed this week (${Math.round(completionRate7d)}% rate).`,
          actionable: 'Even 5 minutes counts — log it',
        })
      }
    }
  } catch { /* skip */ }

  // 4. FINANCE_CROSSOVER
  try {
    if (transactions.length > 0) {
      const spendByDate = new Map<string, number>()
      for (const tx of transactions) {
        const dk = tx.dateKey || format(tx.date, 'yyyy-MM-dd')
        spendByDate.set(dk, (spendByDate.get(dk) ?? 0) + tx.amount)
      }

      let allHabitsDays: number[] = []
      let otherDays: number[] = []

      let current = parseISO(sixtyDaysAgo)
      const end = parseISO(today)

      while (current <= end) {
        const d = format(current, 'yyyy-MM-dd')
        const dayHabits = habits.filter((h) => {
          const dow = getDay(current)
          if (h.frequency === 'daily') return true
          if (h.frequency === 'weekdays') return dow >= 1 && dow <= 5
          if (h.frequency === 'weekends') return dow === 0 || dow === 6
          if (h.frequency === 'custom') return h.customDays.includes(dow)
          return false
        })

        if (dayHabits.length > 0) {
          const dayLogs = recentLogs.filter((l) => l.date === d && l.completed)
          const doneIds = new Set(dayLogs.map((l) => l.habitId.toString()))
          const allDone = dayHabits.every((h) => doneIds.has(h._id.toString()))

          const spend = spendByDate.get(d) ?? 0
          if (allDone) {
            allHabitsDays.push(spend)
          } else {
            otherDays.push(spend)
          }
        }

        current = addDays(current, 1)
      }

      if (allHabitsDays.length >= 5 && otherDays.length >= 5) {
        const avgAllDone = allHabitsDays.reduce((a, b) => a + b, 0) / allHabitsDays.length
        const avgOther = otherDays.reduce((a, b) => a + b, 0) / otherDays.length

        if (avgOther > 0) {
          const diffPct = Math.abs(avgAllDone - avgOther) / avgOther * 100
          if (diffPct > 15) {
            const lessBetter = avgAllDone < avgOther
            insights.push({
              type: lessBetter ? 'positive' : 'neutral',
              title: 'Your habits affect your spending',
              description: lessBetter
                ? `On days you complete all habits, you spend ${Math.round(diffPct)}% less on average.`
                : `On days you complete all habits, you spend ${Math.round(diffPct)}% more (possibly rewarding yourself).`,
              metric: `All-habits days: ₹${Math.round(avgAllDone)} avg vs other days: ₹${Math.round(avgOther)} avg`,
            })
          }
        }
      }
    }
  } catch { /* skip */ }

  // 5. HARDEST_HABIT
  try {
    let hardestHabit: { name: string; missRate: number } | null = null
    for (const habit of habits) {
      const habitLogs = recentLogs.filter(
        (l) => l.habitId.toString() === habit._id.toString() && l.date >= thirtyDaysAgo,
      )
      const expected = getExpectedDates(habit.frequency, habit.customDays, thirtyDaysAgo, today)
      if (expected.length === 0) continue
      const completedSet = new Set(habitLogs.filter((l) => l.completed).map((l) => l.date))
      const missed = expected.filter((d) => !completedSet.has(d)).length
      const missRate = missed / expected.length

      if (!hardestHabit || missRate > hardestHabit.missRate) {
        hardestHabit = { name: habit.name, missRate }
      }
    }

    if (hardestHabit && hardestHabit.missRate > 0.5) {
      insights.push({
        type: 'warning',
        title: `"${hardestHabit.name}" is your hardest habit`,
        description: `${Math.round(hardestHabit.missRate * 100)}% miss rate over the last 30 days`,
        actionable: 'Consider reducing the target or difficulty level',
      })
    }
  } catch { /* skip */ }

  // 6. MOST_IMPROVED
  try {
    let bestImproved: { name: string; improvement: number } | null = null
    for (const habit of habits) {
      const recentHabitLogs = recentLogs.filter(
        (l) => l.habitId.toString() === habit._id.toString() && l.date >= thirtyDaysAgo,
      )
      const prevHabitLogs = recentLogs.filter(
        (l) => l.habitId.toString() === habit._id.toString() &&
          l.date >= prevThirtyStart && l.date <= prevThirtyEnd,
      )

      const recentExpected = getExpectedDates(habit.frequency, habit.customDays, thirtyDaysAgo, today)
      const prevExpected = getExpectedDates(habit.frequency, habit.customDays, prevThirtyStart, prevThirtyEnd)

      if (recentExpected.length === 0 || prevExpected.length === 0) continue

      const recentDone = new Set(recentHabitLogs.filter((l) => l.completed).map((l) => l.date))
      const prevDone = new Set(prevHabitLogs.filter((l) => l.completed).map((l) => l.date))

      const recentRate = recentExpected.filter((d) => recentDone.has(d)).length / recentExpected.length * 100
      const prevRate = prevExpected.filter((d) => prevDone.has(d)).length / prevExpected.length * 100

      const improvement = recentRate - prevRate
      if (!bestImproved || improvement > bestImproved.improvement) {
        bestImproved = { name: habit.name, improvement }
      }
    }

    if (bestImproved && bestImproved.improvement > 20) {
      insights.push({
        type: 'positive',
        title: `"${bestImproved.name}" is trending up!`,
        description: `${Math.round(bestImproved.improvement)}% improvement compared to last month`,
      })
    }
  } catch { /* skip */ }

  // 7. BEST_DAY
  try {
    const completionByDow = new Array(7).fill(0).map(() => ({ done: 0, total: 0 }))
    for (const log of recentLogs.filter((l) => l.date >= sixtyDaysAgo)) {
      const dow = getDay(parseISO(log.date))
      if (log.completed) completionByDow[dow].done++
      completionByDow[dow].total++
    }

    let bestDow = -1
    let bestRate = 0
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    for (let i = 0; i < 7; i++) {
      if (completionByDow[i].total >= 10) {
        const rate = completionByDow[i].done / completionByDow[i].total * 100
        if (rate > bestRate) { bestRate = rate; bestDow = i }
      }
    }

    if (bestDow !== -1) {
      insights.push({
        type: 'positive',
        title: `${DAY_NAMES[bestDow]} is your best day`,
        description: `${Math.round(bestRate)}% average completion on ${DAY_NAMES[bestDow]}s`,
      })
    }
  } catch { /* skip */ }

  // 8. MOMENTUM
  try {
    let momentumDays = 0
    for (let i = 0; i < 60; i++) {
      const d = format(addDays(new Date(), -i), 'yyyy-MM-dd')
      const dayLogs = recentLogs.filter((l) => l.date === d && l.completed)
      if (dayLogs.length > 0) {
        momentumDays++
      } else {
        break
      }
    }

    if (momentumDays > 2) {
      insights.push({
        type: 'positive',
        title: `You're on a ${momentumDays}-day active streak!`,
        description: `You've logged at least one habit for ${momentumDays} days straight.`,
        actionable: "Keep going — don't break the chain!",
      })
    }
  } catch { /* skip */ }

  // 9. NO_SPEND_HABIT_CORRELATION
  try {
    if (transactions.length > 0) {
      const spendDates = new Set(transactions.map((t) => t.dateKey || format(t.date, 'yyyy-MM-dd')))

      let noSpendHabitDone = 0
      let noSpendTotal = 0
      let spendHabitDone = 0
      let spendTotal = 0

      for (const log of recentLogs) {
        if (spendDates.has(log.date)) {
          spendTotal++
          if (log.completed) spendHabitDone++
        } else {
          noSpendTotal++
          if (log.completed) noSpendHabitDone++
        }
      }

      if (noSpendTotal >= 10 && spendTotal >= 10) {
        const noSpendRate = noSpendHabitDone / noSpendTotal * 100
        const spendRate = spendHabitDone / spendTotal * 100

        if (noSpendRate - spendRate > 10) {
          insights.push({
            type: 'positive',
            title: 'No-spend days boost your habits',
            description: `On no-spend days your habit completion jumps to ${Math.round(noSpendRate)}% (vs ${Math.round(spendRate)}% on spend days).`,
          })
        }
      }
    }
  } catch { /* skip */ }

  // Sort: warning first, positive second, neutral last; max 8
  return insights
    .sort((a, b) => {
      const order = { warning: 0, positive: 1, neutral: 2 }
      return order[a.type] - order[b.type]
    })
    .slice(0, 8)
}
