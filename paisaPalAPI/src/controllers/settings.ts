import type { Request, Response } from 'express';
import { connectDB } from '../lib/mongodb';
import Settings from '../models/Settings';
import type { SettingsInput } from '../schemas';

export async function getSettings(_req: Request, res: Response) {
  await connectDB();

  const settings = await Settings.findByIdAndUpdate(
    'default',
    { $setOnInsert: { _id: 'default', stipend: 12000, extra: 0 } },
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

  const settings = await Settings.findByIdAndUpdate(
    'default',
    { $set: body, $setOnInsert: { _id: 'default' } },
    { new: true, upsert: true, runValidators: true },
  ).lean();

  return res.status(200).json({
    data: settings,
    error: null,
  });
}
