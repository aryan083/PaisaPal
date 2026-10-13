import { Router } from 'express';
import auditRouter from './audit';
import authRouter from './auth';
import budgetsRouter from './budgets';
import envelopesRouter from './envelopes';
import ingestRouter from './ingest';
import recurringTransactionsRouter from './recurringTransactions';
import savingsRouter from './savings';
import settingsRouter from './settings';
import statsRouter from './stats';
import syncRouter from './sync';
import transactionsRouter from './transactions';

const router = Router();

router.use('/auth', authRouter);
router.use('/audit', auditRouter);
router.use('/ingest', ingestRouter);
router.use('/sync', syncRouter);
router.use('/transactions', transactionsRouter);
router.use('/settings', settingsRouter);
router.use('/stats', statsRouter);
router.use('/recurring-transactions', recurringTransactionsRouter);
router.use('/budgets', budgetsRouter);
router.use('/savings', savingsRouter);
router.use('/envelopes', envelopesRouter);

export default router;
