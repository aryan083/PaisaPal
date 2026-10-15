import { Router } from 'express';
import { approveInbox, listInbox } from '../controllers/inbox';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { InboxApproveSchema, InboxQuerySchema } from '../schemas';

const router = Router();
router.use(requireAuth);
router.get('/', validate(InboxQuerySchema, 'query'), asyncHandler(listInbox));
router.post('/:kind/:id/approve', validate(InboxApproveSchema, 'body'), asyncHandler(approveInbox));
export default router;
