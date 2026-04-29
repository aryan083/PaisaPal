import type { Request, Response } from 'express'
import { addDays, format, parseISO, getDay } from 'date-fns'
import { connectDB } from '../lib/mongodb'
import Habit from '../models/Habit'
import HabitLog from '../models/HabitLog'
import Transaction from '../models/Transaction'
import Settings from '../models/Settings'
import SavingsGoal from '../models/SavingsGoal'
import { getConsistencyScore } from '../lib/streakEngine'

// Import Settings and SavingsGoal models from Paisa Tracker (same DB)
// These are read-only references
import mongoose, { type Document, type Model, Schema } from 'mongoose'

// Inline settings schema (read-only)
interface ISettings {
  userId: mongoose.Types.ObjectId
  stipend: number
  extra: number
}

const settingsSchema = new Schema<ISettings>({
  userId: { type: Schema.Types.ObjectId, required: true, unique: true },
  stipend: { type: Number, default: 12000 },
  extra: { type: Number, default: 0 },
}, { timestamps: false })

const SettingsModel: Model<ISettings> =
  mongoose.models.Settings ?? mongoose.model<ISettings>('Settings', settingsSchema)

// SavingsGoal schema (read-only)
interface ISavingsGoal {
  userId: mongoose.Types.ObjectId
  targetAmount: number
  savedAmount: number
  status: string
}

const savingsGoalSchema = new Schema<ISavingsGoal>({
  userId: { type: Schema.Types.ObjectId, required: true },
  targetAmount: { type: Number },
  savedAmount: { type: Number },
  status: { type: String },
}, { timestamps: false })

const SavingsGoalModel: Model<ISavingsGoal> =
  mongoose.models.SavingsGoal ?? mongoose.model<ISavingsGoal>('SavingsGoal', savingsGoalSchema)

export async function getLifeScore(req: Request, res: Response): Promise<void> {
  await connectDB()
  const userId = req.user!.userId

  const today = format(new Date(), 'yyyy-MM-dd')
  const thisMonthStart = today.slice(0, 8) + '01'

  const [habits, settings, savingsGoals, monthTransactions] = await Promise.all([
    Habit.find({ userId, isArchived: false }).lean(),
    SettingsModel.findOne({ userId }).lean(),
    SavingsGoalModel.find({ userId, status: 'active' }).lean(),
    Transaction.find({
      userId,
      dateKey: { $gte: thisMonthStart, $lte: today },
    }).lean().catch(() => []),
  ])

  // Finance score
  const budget = (settings?.stipend ?? 12000) + (settings?.extra ?? 0)
  const totalSpentThisMonth = monthTransactions.reduce((sum, t) => sum + t.amount, 0)
  const budgetDiscipline = Math.max(0, Math.min(100, (1 - totalSpentThisMonth / budget) * 100))

  let savingsProgress = 50 // Default if no goals
  if (savingsGoals.length > 0) {
    const totalTarget = savingsGoals.reduce((s, g) => s + (g.targetAmount ?? 0), 0)
    const totalSaved = savingsGoals.reduce((s, g) => s + (g.savedAmount ?? 0), 0)
    savingsProgress = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 50
  }

  const financeScore = Math.round((budgetDiscipline + savingsProgress) / 2)

  // Habit score
  const thirtyDaysAgo = format(addDays(new Date(), -30), 'yyyy-MM-dd')
  const recentLogs = await HabitLog.find({ userId, date: { $gte: thirtyDaysAgo, $lte: today } }).lean()

  const consistencies = habits.map((h) => {
    const hl = recentLogs.filter((l) => l.habitId.toString() === h._id.toString())
    return getConsistencyScore(hl, h.frequency, h.customDays, 30)
  })
  const habitConsistency = consistencies.length === 0 ? 0 :
    consistencies.reduce((a, b) => a + b, 0) / consistencies.length

  // Streak health — top 3 habits, normalized to 30d = 100
  const topStreaks = habits
    .sort((a, b) => b.currentStreak - a.currentStreak)
    .slice(0, 3)
    .map((h) => Math.min(100, (h.currentStreak / 30) * 100))
  const streakHealth = topStreaks.length === 0 ? 0 :
    topStreaks.reduce((a, b) => a + b, 0) / topStreaks.length

  const habitScore = Math.round((habitConsistency + streakHealth) / 2)

  // Life score
  const lifeScore = Math.round(financeScore * 0.4 + habitScore * 0.6)

  // Weekly trend — last 8 weeks
  const weeklyTrend = []
  for (let w = 7; w >= 0; w--) {
    const weekEnd = format(addDays(new Date(), -w * 7), 'yyyy-MM-dd')
    const weekStart = format(addDays(parseISO(weekEnd), -6), 'yyyy-MM-dd')

    const weekLogs = recentLogs.filter((l) => l.date >= weekStart && l.date <= weekEnd)
    const weekTx = monthTransactions.filter((t) => {
      const dk = t.dateKey || format(t.date, 'yyyy-MM-dd')
      return dk >= weekStart && dk <= weekEnd
    })

    const wHabitConsistency = habits.length === 0 ? 0 :
      habits.map((h) => {
        const hl = weekLogs.filter((l) => l.habitId.toString() === h._id.toString())
        return getConsistencyScore(hl, h.frequency, h.customDays, 7)
      }).reduce((a, b) => a + b, 0) / habits.length

    const wSpent = weekTx.reduce((s, t) => s + t.amount, 0)
    const wBudget = budget / 4 // approx weekly budget
    const wFinance = Math.max(0, Math.min(100, (1 - wSpent / wBudget) * 100))
    const wLife = Math.round(wFinance * 0.4 + wHabitConsistency * 0.6)

    weeklyTrend.push({
      week: weekStart,
      financeScore: Math.round(wFinance),
      habitScore: Math.round(wHabitConsistency),
      lifeScore: wLife,
    })
  }

  // Top wins and risks
  const topWins: string[] = []
  const topRisks: string[] = []

  if (budgetDiscipline >= 80) topWins.push('Under budget this month')
  if (streakHealth >= 60) topWins.push(`${topStreaks.length} active streak${topStreaks.length !== 1 ? 's' : ''}`)
  if (habitConsistency >= 80) topWins.push('Excellent habit consistency')

  if (budgetDiscipline < 20) topRisks.push(`Spending at ${Math.round(100 - budgetDiscipline)}% of budget`)
  if (habitConsistency < 50) topRisks.push('Habit consistency needs attention')
  const atRiskHabits = habits.filter((h) => h.currentStreak >= 3)
    .sort((a, b) => b.currentStreak - a.currentStreak).slice(0, 1)
  if (atRiskHabits.length > 0) {
    topRisks.push(`${atRiskHabits[0].name} streak at ${atRiskHabits[0].currentStreak} days — keep it up!`)
  }

  res.status(200).json({
    data: {
      lifeScore,
      financeScore,
      habitScore,
      breakdown: {
        budgetDiscipline: Math.round(budgetDiscipline),
        savingsProgress: Math.round(savingsProgress),
        habitConsistency: Math.round(habitConsistency),
        streakHealth: Math.round(streakHealth),
      },
      weeklyTrend,
      topWins,
      topRisks,
    },
    error: null,
  })
}
