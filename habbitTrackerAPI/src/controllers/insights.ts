import type { Request, Response } from 'express'
import { connectDB } from '../lib/mongodb'
import { generateHabitInsights } from '../lib/habitInsights'

export async function getInsights(req: Request, res: Response): Promise<void> {
  await connectDB()
  const userId = req.user!.userId
  const insights = await generateHabitInsights(userId)
  res.status(200).json({ data: { insights }, error: null })
}
