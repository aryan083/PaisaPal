import { Router } from 'express';
import {
  confirmDetectedRecurring,
  createRecurringTransaction,
  deleteRecurringTransaction,
  detectRecurringTransactions,
  listRecurringTransactions,
  markRecurringPaid,
  updateRecurringTransaction,
} from '../controllers/recurringTransactions';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  ConfirmDetectedRecurringSchema,
  RecurringMarkPaidSchema,
  RecurringTransactionCreateSchema,
  RecurringTransactionUpdateSchema,
} from '../schemas';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(listRecurringTransactions));
router.post('/', validate(RecurringTransactionCreateSchema, 'body'), asyncHandler(createRecurringTransaction));
router.put('/:id', validate(RecurringTransactionUpdateSchema, 'body'), asyncHandler(updateRecurringTransaction));
router.delete('/:id', asyncHandler(deleteRecurringTransaction));
router.post('/:id/mark-paid', validate(RecurringMarkPaidSchema, 'body'), asyncHandler(markRecurringPaid));
router.get('/detect', asyncHandler(detectRecurringTransactions));
router.post(
  '/detect/confirm',
  validate(ConfirmDetectedRecurringSchema, 'body'),
  asyncHandler(confirmDetectedRecurring),
);

export default router;
