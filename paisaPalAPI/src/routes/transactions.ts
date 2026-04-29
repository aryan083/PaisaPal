import { Router } from 'express';
import multer from 'multer';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  importTransactionsCsv,
  listTransactions,
  updateTransaction,
} from '../controllers/transactions';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { QueryParamsSchema, TransactionSchema, TransactionUpdateSchema } from '../schemas';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },
});

router.get('/', validate(QueryParamsSchema, 'query'), asyncHandler(listTransactions));
router.post('/', validate(TransactionSchema, 'body'), asyncHandler(createTransaction));
router.post(
  '/import/csv',
  upload.single('file'),
  asyncHandler(importTransactionsCsv),
);
router.get('/:id', asyncHandler(getTransaction));
router.put('/:id', validate(TransactionUpdateSchema, 'body'), asyncHandler(updateTransaction));
router.delete('/:id', asyncHandler(deleteTransaction));

export default router;
