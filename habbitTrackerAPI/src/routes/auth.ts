import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { asyncHandler } from '../middleware/asyncHandler'
import { getMe } from '../controllers/auth'

const router = Router()
router.use(requireAuth)
router.get('/me', asyncHandler(getMe))

export default router
