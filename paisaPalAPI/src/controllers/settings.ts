import type { Request, Response } from 'express';
import { connectDB } from '../lib/mongodb';
import Settings from '../models/Settings';
import type { SettingsInput } from '../schemas';
import { createAuditLog } from '../lib/audit';

export async function getSettings(req: Request, res: Response) {
  await connectDB();

  const userId = req.user!.userId;

  const settings = await Settings.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, stipend: 12000, extra: 0 } },
    { new: true, upsert: true },
  ).lean();

  return res.status(200).json({
    data: settings,
    error: null,
  });
}

export async function upsertSettings(req: Request, res: Response) {
  await connectDB();

  const body = req.body as SettingsInput;
  const userId = req.user!.userId;

  const before = await Settings.findOne({ userId }).lean();

  const settings = await Settings.findOneAndUpdate(
    { userId },
    { $set: body },
    { new: true, upsert: true, runValidators: true },
  ).lean();

  createAuditLog({
    userId,
    action: 'UPDATE',
    resource: 'settings',
    resourceId: userId,
    before: before ?? undefined,
    after: settings ? (settings as Record<string, unknown>) : undefined,
    req,
  });

  return res.status(200).json({
    data: settings,
    error: null,
  });
}
