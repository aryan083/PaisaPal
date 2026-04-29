import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { asyncHandler } from '../middleware/asyncHandler'
import { validate } from '../middleware/validate'
import { listHabits, createHabit, getHabit, updateHabit, archiveHabit, logHabit, getHabitLogs } from '../controllers/habits'
import { listCategories, createCategory } from '../controllers/categories'
import { getHabitStats } from '../controllers/stats'
import { getInsights } from '../controllers/insights'
import {
  HabitCreateSchema,
  HabitUpdateSchema,
  HabitLogSchema,
  CategoryCreateSchema,
  HabitsQuerySchema,
  LogsQuerySchema,
} from '../schemas/habits'

const router = Router()
router.use(requireAuth)

// Categories — must be before /:id to not be caught as an id
router.get('/categories', asyncHandler(listCategories))
router.post('/categories', validate(CategoryCreateSchema), asyncHandler(createCategory))

// Stats + insights
router.get('/stats', asyncHandler(getHabitStats))
router.get('/insights', asyncHandler(getInsights))

// Habits CRUD
router.get('/', validate(HabitsQuerySchema, 'query'), asyncHandler(listHabits))
router.post('/', validate(HabitCreateSchema), asyncHandler(createHabit))
router.get('/:id', asyncHandler(getHabit))
router.put('/:id', validate(HabitUpdateSchema), asyncHandler(updateHabit))
router.delete('/:id', asyncHandler(archiveHabit))

// Logging
router.post('/:id/log', validate(HabitLogSchema), asyncHandler(logHabit))
router.get('/:id/logs', validate(LogsQuerySchema, 'query'), asyncHandler(getHabitLogs))

export default router
