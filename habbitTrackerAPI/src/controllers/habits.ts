import type { Request, Response } from 'express'
import { format, addDays } from 'date-fns'
import { connectDB } from '../lib/mongodb'
import Habit from '../models/Habit'
import HabitLog from '../models/HabitLog'
import HabitCategory, { seedDefaultCategories } from '../models/HabitCategory'
import { calculateCurrentStreak, calculateLongestStreak, getConsistencyScore, predictStreakRisk } from '../lib/streakEngine'
import { awardXP, XP_REWARDS } from '../lib/xpEngine'
import { checkAndAwardBadges } from '../lib/badgeEngine'
import type { HabitCreateInput, HabitUpdateInput, HabitLogInput, HabitsQuery, LogsQuery } from '../schemas/habits'

export async function listHabits(req: Request, res: Response): Promise<void> {
  await connectDB()
  const userId = req.user!.userId
  const query = req.query as unknown as HabitsQuery

  const filter: Record<string, unknown> = { userId, isArchived: query.isArchived ?? false }
  if (query.categoryId) filter.categoryId = query.categoryId

  const habits = await Habit.find(filter).sort({ order: 1 }).lean()

  const today = format(new Date(), 'yyyy-MM-dd')
  let habitList: unknown[] = habits

  if (query.includeToday) {
    const todayLogs = await HabitLog.find({
      userId,
      date: today,
      habitId: { $in: habits.map((h) => h._id) },
    }).lean()

    const logMap = new Map(todayLogs.map((l) => [l.habitId.toString(), l]))

    // Compute consistency score for each habit
    const thirtyDaysAgo = format(addDays(new Date(), -30), 'yyyy-MM-dd')
    const recentLogs = await HabitLog.find({
      userId,
      date: { $gte: thirtyDaysAgo, $lte: today },
    }).lean()

    habitList = habits.map((h) => {
      const habitLogs = recentLogs.filter((l) => l.habitId.toString() === h._id.toString())
      const consistencyScore = getConsistencyScore(habitLogs, h.frequency, h.customDays, 30)
      return {
        ...h,
        todayLog: logMap.get(h._id.toString()) ?? null,
        consistencyScore,
      }
    })
  }

  res.status(200).json({ data: habitList, error: null })
}

export async function createHabit(req: Request, res: Response): Promise<void> {
  await connectDB()
  const userId = req.user!.userId
  const body = req.body as HabitCreateInput

  // Seed default categories if user has none
  const catCount = await HabitCategory.countDocuments({ userId })
  if (catCount === 0) {
    await seedDefaultCategories(userId)
  }

  // Fetch category to inherit color
  const category = await HabitCategory.findOne({ _id: body.categoryId, userId }).lean()

  const habit = await Habit.create({
    ...body,
    userId,
    color: body.color ?? category?.color ?? '#7c6aff',
  })

  void checkAndAwardBadges(userId, habit._id.toString(), 'first_habit')

  res.status(201).json({ data: habit, error: null, message: 'Created' })
}

export async function getHabit(req: Request, res: Response): Promise<void> {
  await connectDB()
  const userId = req.user!.userId

  const habit = await Habit.findOne({ _id: req.params.id, userId }).lean()
  if (!habit) {
    res.status(404).json({ data: null, error: 'Habit not found', errorCode: 'NOT_FOUND' })
    return
  }

  const thirtyDaysAgo = format(addDays(new Date(), -30), 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')

  const logs = await HabitLog.find({
    habitId: habit._id,
    date: { $gte: thirtyDaysAgo, $lte: today },
  }).sort({ date: 1 }).lean()

  const streakRisk = predictStreakRisk(logs, habit.currentStreak, habit.frequency, habit.customDays)

  res.status(200).json({ data: { ...habit, logs, streakRisk }, error: null })
}

export async function updateHabit(req: Request, res: Response): Promise<void> {
  await connectDB()
  const userId = req.user!.userId
  const body = req.body as HabitUpdateInput

  const habit = await Habit.findOne({ _id: req.params.id, userId })
  if (!habit) {
    res.status(404).json({ data: null, error: 'Habit not found', errorCode: 'NOT_FOUND' })
    return
  }

  Object.assign(habit, body)

  // Recalculate streaks if frequency changed
  if (body.frequency !== undefined || body.customDays !== undefined) {
    const logs = await HabitLog.find({ habitId: habit._id }).sort({ date: 1 }).lean()
    const today = format(new Date(), 'yyyy-MM-dd')
    habit.currentStreak = calculateCurrentStreak(logs, habit.frequency, habit.customDays, today)
    habit.longestStreak = calculateLongestStreak(logs, habit.frequency, habit.customDays)
  }

  await habit.save()

  res.status(200).json({ data: habit, error: null })
}

export async function archiveHabit(req: Request, res: Response): Promise<void> {
  await connectDB()
  const userId = req.user!.userId

  const habit = await Habit.findOneAndUpdate(
    { _id: req.params.id, userId },
    { $set: { isArchived: true } },
    { new: true },
  ).lean()

  if (!habit) {
    res.status(404).json({ data: null, error: 'Habit not found', errorCode: 'NOT_FOUND' })
    return
  }

  res.status(200).json({ data: habit, error: null })
}

export async function logHabit(req: Request, res: Response): Promise<void> {
  await connectDB()
  const userId = req.user!.userId
  const habitId = req.params.id
  const body = req.body as HabitLogInput

  const habit = await Habit.findOne({ _id: habitId, userId })
  if (!habit) {
    res.status(404).json({ data: null, error: 'Habit not found', errorCode: 'NOT_FOUND' })
    return
  }

  // Upsert the log — compound unique index ensures one log per habit per day
  const log = await HabitLog.findOneAndUpdate(
    { habitId, date: body.date },
    {
      $set: {
        userId,
        completed: body.completed,
        value: body.value ?? 0,
        note: body.note,
        loggedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  // Recalculate streaks from actual log history
  const fourHundredDaysAgo = format(addDays(new Date(), -400), 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')
  const allLogs = await HabitLog.find({
    habitId,
    date: { $gte: fourHundredDaysAgo },
  }).sort({ date: 1 }).lean()

  const currentStreak = calculateCurrentStreak(allLogs, habit.frequency, habit.customDays, today)
  const longestStreak = calculateLongestStreak(allLogs, habit.frequency, habit.customDays)

  const updatedHabit = await Habit.findByIdAndUpdate(
    habitId,
    {
      $set: { currentStreak, longestStreak },
      $inc: { totalAttempts: 1, ...(body.completed ? { totalCompletions: 1 } : {}) },
    },
    { new: true },
  ).lean()

  // Fire-and-forget side effects
  let xpAwarded = 0
  if (body.completed) {
    xpAwarded = XP_REWARDS.HABIT_COMPLETION

    // Streak bonus XP
    if (currentStreak === 7) xpAwarded += XP_REWARDS.STREAK_7_BONUS
    else if (currentStreak === 30) xpAwarded += XP_REWARDS.STREAK_30_BONUS
    else if (currentStreak === 100) xpAwarded += XP_REWARDS.STREAK_100_BONUS

    void awardXP(userId, xpAwarded, `Completed ${habit.name}`, 'habit')
  }

  void checkAndAwardBadges(userId, habitId, 'log')

  res.status(200).json({
    data: {
      log,
      habit: updatedHabit,
      xpAwarded: body.completed ? xpAwarded : 0,
      newBadges: [],
      leveledUp: false,
    },
    error: null,
  })
}

export async function getHabitLogs(req: Request, res: Response): Promise<void> {
  await connectDB()
  const userId = req.user!.userId
  const habitId = req.params.id
  const query = req.query as unknown as LogsQuery

  const habit = await Habit.findOne({ _id: habitId, userId }).lean()
  if (!habit) {
    res.status(404).json({ data: null, error: 'Habit not found', errorCode: 'NOT_FOUND' })
    return
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  const defaultFrom = format(addDays(new Date(), -365), 'yyyy-MM-dd')

  const from = query.from ?? defaultFrom
  const to = query.to ?? today

  const logs = await HabitLog.find({
    habitId,
    date: { $gte: from, $lte: to },
  }).sort({ date: 1 }).lean()

  res.status(200).json({ data: logs, error: null })
}
