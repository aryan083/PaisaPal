import { Router } from 'express'
import habitsRouter from './habits'
import achievementsRouter from './achievements'
import lifeRouter from './life'
import authRouter from './auth'

const router = Router()

router.use('/auth', authRouter)
router.use('/habits', habitsRouter)
router.use('/achievements', achievementsRouter)
router.use('/life', lifeRouter)

export default router
