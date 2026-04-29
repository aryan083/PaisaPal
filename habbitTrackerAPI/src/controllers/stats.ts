import type { Request, Response } from 'express'
import { format, addDays } from 'date-fns'
import { connectDB } from '../lib/mongodb'
import Habit from '../models/Habit'
import HabitLog from '../models/HabitLog'
import HabitCategory from '../models/HabitCategory'
import { getHeatmapData, getFailureAnalysis, getMovingAverage } from '../lib/habitStats'
import { getConsistencyScore } from '../lib/streakEngine'

export async function getHabitStats(req: Request, res: Response): Promise<void> {
  await connectDB()
  const userId = req.user!.userId

  const today = format(new Date(), 'yyyy-MM-dd')
  const thirtyDaysAgo = format(addDays(new Date(), -30), 'yyyy-MM-dd')
  const sevenDaysAgo = format(addDays(new Date(), -7), 'yyyy-MM-dd')

  const [habits, categories, recentLogs, todayLogs] = await Promise.all([
    Habit.find({ userId, isArchived: false }).lean(),
    HabitCategory.find({ userId }).sort({ order: 1 }).lean(),
    HabitLog.find({ userId, date: { $gte: thirtyDaysAgo, $lte: today } }).lean(),
    HabitLog.find({ userId, date: today }).lean(),
  ])

  const activeHabits = habits.length
  const totalCompletionsToday = todayLogs.filter((l) => l.completed).length

  // today's scheduled habits
  const { getDay } = await import('date-fns')
  const { parseISO } = await import('date-fns')
  const todayDow = getDay(parseISO(today))
  const totalHabitsToday = habits.filter((h) => {
    if (h.frequency === 'daily') return true
    if (h.frequency === 'weekdays') return todayDow >= 1 && todayDow <= 5
    if (h.frequency === 'weekends') return todayDow === 0 || todayDow === 6
    if (h.frequency === 'custom') return h.customDays.includes(todayDow)
    return false
  }).length

  // Overall consistency score
  const allConsistencies: number[] = []
  for (const h of habits) {
    const habitLogs = recentLogs.filter((l) => l.habitId.toString() === h._id.toString())
    const score = getConsistencyScore(habitLogs, h.frequency, h.customDays, 30)
    allConsistencies.push(score)
  }
  const overallConsistencyScore = allConsistencies.length === 0 ? 0 :
    Math.round(allConsistencies.reduce((a, b) => a + b, 0) / allConsistencies.length * 10) / 10

  // By category
  const catMap = new Map(categories.map((c) => [c._id.toString(), c]))
  const byCategory = categories.map((cat) => {
    const catHabits = habits.filter((h) => h.categoryId.toString() === cat._id.toString())
    const catConsistencies = catHabits.map((h) => {
      const hl = recentLogs.filter((l) => l.habitId.toString() === h._id.toString())
      return getConsistencyScore(hl, h.frequency, h.customDays, 30)
    })
    const avgConsistency = catConsistencies.length === 0 ? 0 :
      Math.round(catConsistencies.reduce((a, b) => a + b, 0) / catConsistencies.length * 10) / 10
    return {
      categoryId: cat._id.toString(),
      categoryName: cat.name,
      color: cat.color,
      icon: cat.icon,
      habitCount: catHabits.length,
      avgConsistency,
    }
  }).filter((c) => c.habitCount > 0)

  // Streak leaders
  const streakLeaders = habits
    .sort((a, b) => b.currentStreak - a.currentStreak)
    .slice(0, 3)
    .map((h) => ({
      habitId: h._id.toString(),
      name: h.name,
      icon: h.icon,
      currentStreak: h.currentStreak,
    }))

  // Weekly completion (last 7 days)
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weeklyCompletion = []
  for (let i = 6; i >= 0; i--) {
    const d = format(addDays(new Date(), -i), 'yyyy-MM-dd')
    const dow = getDay(parseISO(d))
    const dayHabits = habits.filter((h) => {
      if (h.frequency === 'daily') return true
      if (h.frequency === 'weekdays') return dow >= 1 && dow <= 5
      if (h.frequency === 'weekends') return dow === 0 || dow === 6
      if (h.frequency === 'custom') return h.customDays.includes(dow)
      return false
    })
    const dayLogs = recentLogs.filter((l) => l.date === d && l.completed)
    const completed = dayLogs.length
    const total = dayHabits.length
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100)
    weeklyCompletion.push({ date: d, dayName: DAY_NAMES[dow], completed, total, percentage })
  }

  // Heatmap
  const heatmapData = await getHeatmapData(userId, habits, 365)

  // Failure analysis
  const failureAnalysis = await getFailureAnalysis(userId, habits)

  // Radar chart
  const radarData = byCategory.map((cat) => ({
    category: cat.categoryName,
    icon: catMap.get(cat.categoryId)?.icon ?? '🎯',
    color: cat.color,
    score: cat.avgConsistency,
  }))

  // Moving average — compute from 90 days daily completions
  const ninetyDaysAgo = format(addDays(new Date(), -90), 'yyyy-MM-dd')
  const ninetydayLogs = await HabitLog.find({ userId, date: { $gte: ninetyDaysAgo, $lte: today } }).lean()

  const dailyRaw: { date: string; value: number }[] = []
  for (let i = 90; i >= 0; i--) {
    const d = format(addDays(new Date(), -i), 'yyyy-MM-dd')
    const dow = getDay(parseISO(d))
    const dayHabits = habits.filter((h) => {
      if (h.frequency === 'daily') return true
      if (h.frequency === 'weekdays') return dow >= 1 && dow <= 5
      if (h.frequency === 'weekends') return dow === 0 || dow === 6
      if (h.frequency === 'custom') return h.customDays.includes(dow)
      return false
    })
    if (dayHabits.length === 0) { dailyRaw.push({ date: d, value: 0 }); continue }
    const done = ninetydayLogs.filter((l) => l.date === d && l.completed).length
    dailyRaw.push({ date: d, value: Math.round((done / dayHabits.length) * 100) })
  }

  const movingAverage = getMovingAverage(dailyRaw, 7)

  res.status(200).json({
    data: {
      totalHabits: activeHabits,
      activeHabits,
      totalCompletionsToday,
      totalHabitsToday,
      overallConsistencyScore,
      byCategory,
      streakLeaders,
      weeklyCompletion,
      heatmapData,
      failureAnalysis,
      radarData,
      movingAverage,
    },
    error: null,
  })
}
