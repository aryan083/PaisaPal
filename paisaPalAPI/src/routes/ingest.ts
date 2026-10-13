import { Router } from 'express';
import { z } from 'zod';

import { ingestRapido, ingestSms } from '../controllers/ingest';
import { ingestReceipt } from '../controllers/receipt';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';

const router = Router();

// NOTE: intentionally NO requireAuth here — iPhone Shortcuts authenticates
// with the long-lived SMS_INGEST_SECRET via x-ingest-secret header instead
// of the 7-day user JWT (Shortcuts can't refresh JWTs).
export const SmsIngestSchema = z.object({
  sender: z.string().min(1).max(64),
  body: z.string().min(10).max(2000),
  receivedAt: z.coerce.date().optional(),
});

export const RapidoIngestSchema = z.object({
  subject: z.string().min(1).max(300),
  // 60kb: Apple Mail forwards full HTML (styles, map URLs). The controller
  // strips to plain text and stores ≤8000 chars; the 100kb JSON cap still guards.
  body: z.string().min(10).max(60000),
  receivedAt: z.coerce.date().optional(),
});

export const ReceiptIngestSchema = z.object({
  app: z.string().min(1).max(32).optional(),
  subject: z.string().min(1).max(300),
  // Same HTML-mail reasoning as Rapido above.
  body: z.string().min(10).max(60000),
  receivedAt: z.coerce.date().optional(),
});

router.post('/sms', validate(SmsIngestSchema, 'body'), asyncHandler(ingestSms));
router.post('/rapido', validate(RapidoIngestSchema, 'body'), asyncHandler(ingestRapido));
router.post('/receipt', validate(ReceiptIngestSchema, 'body'), asyncHandler(ingestReceipt));

export default router;
