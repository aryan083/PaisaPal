import type { Request, Response } from 'express'
import { connectDB } from '../lib/mongodb'
import { User } from '../models/User'

export async function getMe(req: Request, res: Response): Promise<void> {
  await connectDB()
  const userId = req.user!.userId

  const user = await User.findById(userId).select('_id email name').lean()
  if (!user) {
    res.status(404).json({ data: null, error: 'User not found', errorCode: 'USER_NOT_FOUND' })
    return
  }

  res.status(200).json({ data: { _id: user._id, email: user.email, name: user.name }, error: null })
}
