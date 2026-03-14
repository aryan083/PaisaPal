import { Router } from 'express';
import multer from 'multer';
import {
  createTransaction,
  deleteTransaction,
  exportTransactionsCsv,
  getTransaction,
  importTransactionsCsv,
  listTransactions,
  remapCategory,
  updateTransaction,
} from '../controllers/transactions';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import {
  QueryParamsSchema,
  RemapCategorySchema,
  TransactionSchema,
  TransactionUpdateSchema,
} from '../schemas';

const router = Router();

router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },
});

router.get('/', validate(QueryParamsSchema, 'query'), asyncHandler(listTransactions));
router.get('/export/csv', validate(QueryParamsSchema, 'query'), asyncHandler(exportTransactionsCsv));
router.post('/', validate(TransactionSchema, 'body'), asyncHandler(createTransaction));
router.post(
  '/import/csv',
  upload.single('file'),
  asyncHandler(importTransactionsCsv),
);
router.put('/remap-category', validate(RemapCategorySchema, 'body'), asyncHandler(remapCategory));
router.get('/:id', asyncHandler(getTransaction));
router.put('/:id', validate(TransactionUpdateSchema, 'body'), asyncHandler(updateTransaction));
router.delete('/:id', asyncHandler(deleteTransaction));

export default router;
