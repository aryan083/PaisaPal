import type { Request, Response } from 'express'
import { connectDB } from '../lib/mongodb'
import HabitCategory, { seedDefaultCategories } from '../models/HabitCategory'
import type { CategoryCreateInput } from '../schemas/habits'

export async function listCategories(req: Request, res: Response): Promise<void> {
  await connectDB()
  const userId = req.user!.userId

  const count = await HabitCategory.countDocuments({ userId })
  if (count === 0) {
    await seedDefaultCategories(userId)
  }

  const categories = await HabitCategory.find({ userId }).sort({ order: 1 }).lean()
  res.status(200).json({ data: categories, error: null })
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  await connectDB()
  const userId = req.user!.userId
  const body = req.body as CategoryCreateInput

  const maxOrder = await HabitCategory.findOne({ userId }).sort({ order: -1 }).lean()
  const nextOrder = (maxOrder?.order ?? -1) + 1

  const category = await HabitCategory.create({
    ...body,
    userId,
    order: nextOrder,
    isDefault: false,
  })

  res.status(201).json({ data: category, error: null, message: 'Created' })
}
