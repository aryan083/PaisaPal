import UserXP from '../models/UserXP'
import type { IBadge } from '../models/Badge'

export const XP_REWARDS = {
  HABIT_COMPLETION: 10,
  STREAK_7_BONUS: 50,
  STREAK_30_BONUS: 200,
  STREAK_100_BONUS: 1000,
  PERFECT_WEEK: 100,
  PERFECT_MONTH: 500,
  BADGE_EARNED: 75,
  UNDER_BUDGET_DAY: 5,
  SAVINGS_GOAL_REACHED: 150,
  NO_SPEND_DAY: 20,
  MIND_AND_MONEY_DAY: 30,
} as const

export function calculateLevel(totalXP: number): {
  level: number
  currentLevelXP: number
  nextLevelXP: number
  progressPercent: number
} {
  let level = 1
  let xpConsumed = 0

  while (true) {
    const needed = Math.floor(100 * Math.pow(level, 1.5))
    if (xpConsumed + needed > totalXP) {
      const currentLevelXP = totalXP - xpConsumed
      const progressPercent = Math.round((currentLevelXP / needed) * 100)
      return { level, currentLevelXP, nextLevelXP: needed, progressPercent }
    }
    xpConsumed += needed
    level++
    if (level > 100) break
  }

  return { level: 100, currentLevelXP: 0, nextLevelXP: 1, progressPercent: 100 }
}

export function getLevelTitle(level: number): string {
  if (level >= 20) return 'Legendary'
  if (level >= 15) return 'Discipline Guru'
  if (level >= 10) return 'Life Optimizer'
  if (level >= 7) return 'Streak Master'
  if (level >= 5) return 'Consistency Pro'
  if (level >= 4) return 'Habit Builder'
  if (level >= 3) return 'Practitioner'
  if (level >= 2) return 'Learner'
  return 'Beginner'
}

export async function awardXP(
  userId: string,
  amount: number,
  reason: string,
  source: 'habit' | 'finance' | 'badge' | 'streak',
): Promise<{ newTotalXP: number; leveledUp: boolean; newLevel?: number; newLevelTitle?: string }> {
  if (amount <= 0) {
    return { newTotalXP: 0, leveledUp: false }
  }

  const today = new Date().toISOString().slice(0, 10)

  const existingXP = await UserXP.findOne({ userId })
  const prevLevel = existingXP ? calculateLevel(existingXP.totalXP).level : 1

  const updated = await UserXP.findOneAndUpdate(
    { userId },
    {
      $inc: { totalXP: amount },
      $push: {
        xpHistory: {
          $each: [{ date: today, amount, reason, source }],
          $slice: -200,
        },
      },
      $set: { updatedAt: new Date() },
      $setOnInsert: { userId },
    },
    { upsert: true, new: true },
  )

  if (!updated) return { newTotalXP: 0, leveledUp: false }

  const levelInfo = calculateLevel(updated.totalXP)
  await UserXP.updateOne(
    { userId },
    {
      $set: {
        level: levelInfo.level,
        currentLevelXP: levelInfo.currentLevelXP,
        nextLevelXP: levelInfo.nextLevelXP,
      },
    },
  )

  const leveledUp = levelInfo.level > prevLevel
  return {
    newTotalXP: updated.totalXP,
    leveledUp,
    newLevel: leveledUp ? levelInfo.level : undefined,
    newLevelTitle: leveledUp ? getLevelTitle(levelInfo.level) : undefined,
  }
}
