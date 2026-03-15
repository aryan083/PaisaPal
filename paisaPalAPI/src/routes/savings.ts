import { Router } from 'express';
import {
  contributeToSavingsGoal,
  createSavingsGoal,
  deleteSavingsGoal,
  getSavingsGoalHistory,
  listSavingsGoals,
  updateSavingsGoal,
} from '../controllers/savings';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  SavingsContributionCreateSchema,
  SavingsGoalCreateSchema,
  SavingsGoalUpdateSchema,
} from '../schemas';

const router = Router();

router.use(requireAuth);

router.get('/goals', asyncHandler(listSavingsGoals));
router.post('/goals', validate(SavingsGoalCreateSchema, 'body'), asyncHandler(createSavingsGoal));
router.put('/goals/:id', validate(SavingsGoalUpdateSchema, 'body'), asyncHandler(updateSavingsGoal));
router.delete('/goals/:id', asyncHandler(deleteSavingsGoal));
router.post(
  '/goals/:id/contribute',
  validate(SavingsContributionCreateSchema, 'body'),
  asyncHandler(contributeToSavingsGoal),
);
router.get('/goals/:id/history', asyncHandler(getSavingsGoalHistory));

export default router;
