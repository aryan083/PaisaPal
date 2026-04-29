import { Router, Request, Response } from 'express'
import { AuditLog } from '../models/AuditLog'
import { requireAuth } from '../middleware/auth'
import { asyncHandler } from '../middleware/asyncHandler'

const router = Router()

router.use(requireAuth)

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const limit = parseInt(req.query.limit as string) || 50
  const resource = req.query.resource as string | undefined

  const filter: Record<string, unknown> = { userId }
  if (resource) {
    filter.resource = resource
  }

  const logs = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return res.status(200).json({
    data: logs,
    error: null,
  })
}))

export default router
