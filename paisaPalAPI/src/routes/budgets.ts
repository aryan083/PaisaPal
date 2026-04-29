import { Router } from 'express';
import {
  createBudget,
  deleteBudget,
  getBudget,
  getBudgetStats,
  listBudgets,
  updateBudget,
} from '../controllers/budgets';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { BudgetSchema, BudgetUpdateSchema } from '../schemas';

const router = Router();

router.use(requireAuth);

router.get('/stats', asyncHandler(getBudgetStats));
router.get('/', asyncHandler(listBudgets));
router.get('/:id', asyncHandler(getBudget));
router.post('/', validate(BudgetSchema, 'body'), asyncHandler(createBudget));
router.put('/:id', validate(BudgetUpdateSchema, 'body'), asyncHandler(updateBudget));
router.delete('/:id', asyncHandler(deleteBudget));

export default router;
