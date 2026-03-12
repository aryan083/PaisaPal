import { Router } from 'express';
import { getStats } from '../controllers/stats';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(getStats));

export default router;
