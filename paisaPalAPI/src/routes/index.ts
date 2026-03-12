import { Router } from 'express';
import budgetsRouter from './budgets';
import recurringRouter from './recurring';
import settingsRouter from './settings';
import statsRouter from './stats';
import transactionsRouter from './transactions';

const router = Router();

router.use('/transactions', transactionsRouter);
router.use('/settings', settingsRouter);
router.use('/stats', statsRouter);
router.use('/recurring', recurringRouter);
router.use('/budgets', budgetsRouter);

export default router;
