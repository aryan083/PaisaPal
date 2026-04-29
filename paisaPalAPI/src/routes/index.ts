import { Router } from 'express';
import transactionsRouter from './transactions';
import settingsRouter from './settings';
import statsRouter from './stats';

const router = Router();

router.use('/transactions', transactionsRouter);
router.use('/settings', settingsRouter);
router.use('/stats', statsRouter);

export default router;
