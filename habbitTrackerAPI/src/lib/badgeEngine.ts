import { format, addDays, parseISO, getDay } from 'date-fns'
import Badge, { type IBadge } from '../models/Badge'
import Habit from '../models/Habit'
import HabitLog from '../models/HabitLog'
import Transaction from '../models/Transaction'
import { awardXP, XP_REWARDS } from './xpEngine'
import { getExpectedDates } from './streakEngine'

async function upsertBadge(
  userId: string,
  badgeType: string,
  habitId: string | null,
  metadata?: Record<string, unknown>,
): Promise<IBadge | null> {
  const filter = {
    userId,
    badgeType,
    ...(habitId ? { habitId } : { habitId: { $exists: false } }),
  }

  const existing = await Badge.findOne(filter)
  if (existing) return null // already earned

  const badge = await Badge.create({
    userId,
    badgeType,
    ...(habitId ? { habitId } : {}),
    earnedAt: new Date(),
    ...(metadata ? { metadata } : {}),
  })

  void awardXP(userId, XP_REWARDS.BADGE_EARNED, `Badge: ${badgeType}`, 'badge')
  return badge
}

async function isAllHabitsDoneForDay(userId: string, dateStr: string): Promise<boolean> {
  const habits = await Habit.find({ userId, isArchived: false }).lean()
  if (habits.length === 0) return false

  const dow = getDay(parseISO(dateStr))
  const scheduledHabits = habits.filter((h) => {
    if (h.frequency === 'daily') return true
    if (h.frequency === 'weekdays') return dow >= 1 && dow <= 5
    if (h.frequency === 'weekends') return dow === 0 || dow === 6
    if (h.frequency === 'custom') return h.customDays.includes(dow)
    return false
  })

  if (scheduledHabits.length === 0) return false

  const logs = await HabitLog.find({
    userId,
    date: dateStr,
    completed: true,
  }).lean()

  const doneIds = new Set(logs.map((l) => l.habitId.toString()))
  return scheduledHabits.every((h) => doneIds.has(h._id.toString()))
}

export async function checkAndAwardBadges(
  userId: string,
  habitId: string | null,
  trigger: 'log' | 'first_habit' | 'streak' | 'finance' | 'category',
): Promise<IBadge[]> {
  const earned: IBadge[] = []

  try {
    if (trigger === 'first_habit') {
      const habitCount = await Habit.countDocuments({ userId, isArchived: false })
      if (habitCount <= 1) {
        const b = await upsertBadge(userId, 'FIRST_HABIT', null)
        if (b) earned.push(b)
      }

      if (habitCount >= 5) {
        const b = await upsertBadge(userId, 'MULTITASKER', null)
        if (b) earned.push(b)
      }
    }

    if (trigger === 'log' && habitId) {
      // FIRST_LOG
      const logCount = await HabitLog.countDocuments({ userId })
      if (logCount <= 1) {
        const b = await upsertBadge(userId, 'FIRST_LOG', null)
        if (b) earned.push(b)
      }

      // STREAK badges
      const habit = await Habit.findById(habitId).lean()
      if (habit) {
        if (habit.currentStreak >= 7) {
          const b = await upsertBadge(userId, 'STREAK_7', habitId)
          if (b) earned.push(b)
        }
        if (habit.currentStreak >= 30) {
          const b = await upsertBadge(userId, 'STREAK_30', habitId)
          if (b) earned.push(b)
        }
        if (habit.currentStreak >= 100) {
          const b = await upsertBadge(userId, 'STREAK_100', habitId)
          if (b) earned.push(b)
        }

        // COMEBACK_KID: currentStreak == 1 and previous streak ended 7+ days ago
        if (habit.currentStreak === 1) {
          const sevenDaysAgo = format(addDays(new Date(), -7), 'yyyy-MM-dd')
          const recentLog = await HabitLog.findOne({
            habitId,
            date: { $lt: sevenDaysAgo },
            completed: true,
          }).sort({ date: -1 }).lean()

          if (recentLog) {
            const b = await upsertBadge(userId, 'COMEBACK_KID', habitId)
            if (b) earned.push(b)
          }
        }
      }

      // EARLY_BIRD: 7 logs before 8am
      const earlyLogs = await HabitLog.countDocuments({
        userId,
        completed: true,
        $expr: { $lt: [{ $hour: '$loggedAt' }, 8] },
      })
      if (earlyLogs >= 7) {
        const b = await upsertBadge(userId, 'EARLY_BIRD', null)
        if (b) earned.push(b)
      }

      // NIGHT_OWL: 7 logs after 10pm
      const nightLogs = await HabitLog.countDocuments({
        userId,
        completed: true,
        $expr: { $gte: [{ $hour: '$loggedAt' }, 22] },
      })
      if (nightLogs >= 7) {
        const b = await upsertBadge(userId, 'NIGHT_OWL', null)
        if (b) earned.push(b)
      }

      // PERFECT_WEEK: all habits done for last 7 days
      let perfectWeek = true
      const today = format(new Date(), 'yyyy-MM-dd')
      for (let i = 0; i < 7; i++) {
        const d = format(addDays(new Date(), -i), 'yyyy-MM-dd')
        const done = await isAllHabitsDoneForDay(userId, d)
        if (!done) { perfectWeek = false; break }
      }
      if (perfectWeek) {
        const b = await upsertBadge(userId, 'PERFECT_WEEK', null)
        if (b) earned.push(b)
      }

      // PERFECT_MONTH: all habits done for last 30 days
      let perfectMonth = true
      for (let i = 0; i < 30; i++) {
        const d = format(addDays(new Date(), -i), 'yyyy-MM-dd')
        const done = await isAllHabitsDoneForDay(userId, d)
        if (!done) { perfectMonth = false; break }
      }
      if (perfectMonth) {
        const b = await upsertBadge(userId, 'PERFECT_MONTH', null)
        if (b) earned.push(b)
      }
    }

    if (trigger === 'finance') {
      // BUDGET_DISCIPLINE: under budget 30 consecutive days
      // This is a read-only check against Paisa Tracker's Transaction collection
      // Uses dateKey field (YYYY-MM-DD) from Paisa Tracker
      const thirtyDaysAgo = format(addDays(new Date(), -30), 'yyyy-MM-dd')
      const today = format(new Date(), 'yyyy-MM-dd')

      // Check no-spend days (7 consecutive)
      const noSpendCheck = await checkNoSpendStreak(userId, 7)
      if (noSpendCheck) {
        const b = await upsertBadge(userId, 'NO_SPEND_WARRIOR', null)
        if (b) earned.push(b)
      }

      // MIND_AND_MONEY: habits done + under daily budget on 7 different days
      const mindAndMoneyCount = await checkMindAndMoneyDays(userId, thirtyDaysAgo, today)
      if (mindAndMoneyCount >= 7) {
        const b = await upsertBadge(userId, 'MIND_AND_MONEY', null)
        if (b) earned.push(b)
      }
    }
  } catch (err) {
    console.error('Badge check error:', err)
  }

  return earned
}

async function checkNoSpendStreak(userId: string, requiredDays: number): Promise<boolean> {
  try {
    const daysToCheck = requiredDays + 5 // buffer
    const from = format(addDays(new Date(), -daysToCheck), 'yyyy-MM-dd')
    const to = format(new Date(), 'yyyy-MM-dd')

    const spendDays = await Transaction.distinct('dateKey', {
      userId,
      dateKey: { $gte: from, $lte: to },
    }) as string[]

    const spendSet = new Set(spendDays)

    let consecutive = 0
    for (let i = 0; i < daysToCheck; i++) {
      const d = format(addDays(new Date(), -i), 'yyyy-MM-dd')
      if (!spendSet.has(d)) {
        consecutive++
        if (consecutive >= requiredDays) return true
      } else {
        consecutive = 0
      }
    }
    return false
  } catch {
    return false
  }
}

async function checkMindAndMoneyDays(userId: string, from: string, to: string): Promise<number> {
  try {
    const txByDate = await Transaction.aggregate<{ _id: string; total: number }>([
      { $match: { userId, dateKey: { $gte: from, $lte: to } } },
      { $group: { _id: '$dateKey', total: { $sum: '$amount' } } },
    ])

    const spendByDate = new Map(txByDate.map((d) => [d._id, d.total]))

    let count = 0
    let current = parseISO(from)
    const end = parseISO(to)

    while (current <= end) {
      const d = format(current, 'yyyy-MM-dd')
      const allDone = await isAllHabitsDoneForDay(userId, d)
      if (allDone) {
        const spend = spendByDate.get(d) ?? 0
        if (spend === 0) count++ // under-zero-budget approximation — no spend day + all habits
      }
      current = addDays(current, 1)
    }

    return count
  } catch {
    return 0
  }
}
