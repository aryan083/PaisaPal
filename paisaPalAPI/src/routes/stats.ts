import { Router } from 'express';
import { getStats } from '../controllers/stats';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.get('/', asyncHandler(getStats));

export default router;
