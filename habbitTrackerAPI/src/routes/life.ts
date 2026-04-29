import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { asyncHandler } from '../middleware/asyncHandler'
import { getLifeScore } from '../controllers/life'

const router = Router()
router.use(requireAuth)
router.get('/', asyncHandler(getLifeScore))

export default router
