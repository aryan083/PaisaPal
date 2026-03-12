import { Router } from 'express';
import { getSettings, upsertSettings } from '../controllers/settings';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { SettingsSchema } from '../schemas';

const router = Router();

router.get('/', asyncHandler(getSettings));
router.put('/', validate(SettingsSchema, 'body'), asyncHandler(upsertSettings));

export default router;
