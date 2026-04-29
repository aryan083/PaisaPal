import { Router } from 'express';
import {
  createEnvelope,
  getEnvelope,
  handleEnvelopeSurplus,
  updateEnvelope,
} from '../controllers/envelopes';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { EnvelopeCreateSchema, EnvelopeSurplusSchema, EnvelopeUpdateSchema } from '../schemas';

const router = Router();

router.use(requireAuth);

router.get('/:month', asyncHandler(getEnvelope));
router.post('/', validate(EnvelopeCreateSchema, 'body'), asyncHandler(createEnvelope));
router.put('/:month', validate(EnvelopeUpdateSchema, 'body'), asyncHandler(updateEnvelope));
router.post('/:month/surplus', validate(EnvelopeSurplusSchema, 'body'), asyncHandler(handleEnvelopeSurplus));

export default router;
