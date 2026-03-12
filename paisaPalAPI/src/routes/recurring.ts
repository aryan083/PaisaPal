import { Router } from 'express';
import {
  createRecurringRule,
  deleteRecurringRule,
  getRecurringRule,
  listRecurringRules,
  previewRecurringRule,
  runRecurringRules,
  updateRecurringRule,
} from '../controllers/recurring';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { RecurringRuleSchema, RecurringRuleUpdateSchema } from '../schemas';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(listRecurringRules));
router.post('/preview', asyncHandler(previewRecurringRule));
router.get('/run', asyncHandler(runRecurringRules));
router.get('/:id', asyncHandler(getRecurringRule));
router.post('/', validate(RecurringRuleSchema, 'body'), asyncHandler(createRecurringRule));
router.put('/:id', validate(RecurringRuleUpdateSchema, 'body'), asyncHandler(updateRecurringRule));
router.delete('/:id', asyncHandler(deleteRecurringRule));

export default router;
