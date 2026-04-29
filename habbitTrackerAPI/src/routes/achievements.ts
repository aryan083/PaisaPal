import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { asyncHandler } from '../middleware/asyncHandler'
import { getAchievements } from '../controllers/achievements'

const router = Router()
router.use(requireAuth)
router.get('/', asyncHandler(getAchievements))

export default router
