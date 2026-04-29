import type { Request, Response } from 'express'
import { addDays, format } from 'date-fns'
import { connectDB } from '../lib/mongodb'
import Badge from '../models/Badge'
import UserXP from '../models/UserXP'
import { calculateLevel, getLevelTitle } from '../lib/xpEngine'

export async function getAchievements(req: Request, res: Response): Promise<void> {
  await connectDB()
  const userId = req.user!.userId

  // Find or create UserXP
  let xpDoc = await UserXP.findOne({ userId }).lean()
  if (!xpDoc) {
    xpDoc = await UserXP.create({ userId })
    xpDoc = xpDoc.toObject()
  }

  const badges = await Badge.find({ userId }).sort({ earnedAt: -1 }).lean()

  const sevenDaysAgo = format(addDays(new Date(), -7), 'yyyy-MM-dd')
  const recentBadges = badges.filter((b) => {
    const earned = format(b.earnedAt, 'yyyy-MM-dd')
    return earned >= sevenDaysAgo
  })

  const levelInfo = calculateLevel(xpDoc.totalXP)
  const levelTitle = getLevelTitle(levelInfo.level)

  res.status(200).json({
    data: {
      xp: {
        totalXP: xpDoc.totalXP,
        level: levelInfo.level,
        levelTitle,
        currentLevelXP: levelInfo.currentLevelXP,
        nextLevelXP: levelInfo.nextLevelXP,
        progressPercent: levelInfo.progressPercent,
        xpHistory: (xpDoc.xpHistory ?? []).slice(-20).reverse(),
      },
      level: levelInfo.level,
      levelTitle,
      badges,
      unlockedBadgeTypes: badges.map((b) => b.badgeType),
      recentBadges,
      xpHistory: (xpDoc.xpHistory ?? []).slice(-20).reverse(),
    },
    error: null,
  })
}
