import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';

import { User } from '../models/User';

/** Long-lived per-device secret shared with the iPhone Shortcuts. */
export function getIngestSecret(): string | null {
  const s = process.env.SMS_INGEST_SECRET ?? '';
  return s.length >= 16 ? s : null;
}

/** Secret supplied by the caller: x-ingest-secret header or Bearer fallback. */
export function getProvidedIngestSecret(req: Request): string {
  const header = (req.headers['x-ingest-secret'] as string | undefined)?.trim();
  if (header) return header;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return '';
}

/** Which PaisaPal user ingested items belong to (single-user setup). */
export async function resolveIngestUserId(): Promise<string | null> {
  const directId = process.env.SMS_INGEST_USER_ID ?? '';
  if (directId && mongoose.Types.ObjectId.isValid(directId)) return directId;

  const email = (process.env.SMS_INGEST_USER_EMAIL ?? '').trim().toLowerCase();
  if (email) {
    const user = (await User.findOne({ email }).select('_id').lean()) as unknown as {
      _id: mongoose.Types.ObjectId;
    } | null;
    if (user) return user._id.toString();
  }
  return null;
}

/** Stable replay key: same content forwarded twice is the same key. */
export function contentHash(a: string, b: string): string {
  return crypto.createHash('sha256').update(`${a}\n${b}`, 'utf8').digest('hex');
}

/** Shift a YYYY-MM-DD dateKey by N days (IST wall-clock math). */
export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1, 6, 30, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function toIstDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Shared gate for all ingest endpoints (long-lived device secret, not the
 * user JWT). Sends the error response itself; returns the resolved userId,
 * or null when a response was already sent (caller must `return`).
 */
export async function authorizeIngest(req: Request, res: Response): Promise<string | null> {
  const configured = getIngestSecret();
  if (!configured) {
    res.status(500).json({
      data: null,
      error: 'Ingest not configured',
      errorCode: 'SERVER_CONFIG_ERROR',
      suggestion: 'Set SMS_INGEST_SECRET (>=16 chars) and SMS_INGEST_USER_ID or SMS_INGEST_USER_EMAIL on the server.',
      requestId: req.requestId,
    });
    return null;
  }

  const provided = getProvidedIngestSecret(req);
  if (!provided || provided !== configured) {
    res.status(401).json({
      data: null,
      error: 'Invalid ingest secret',
      errorCode: 'INGEST_UNAUTHORIZED',
      suggestion: 'Check x-ingest-secret matches the server secret.',
      requestId: req.requestId,
    });
    return null;
  }

  const userId = await resolveIngestUserId();
  if (!userId) {
    res.status(500).json({
      data: null,
      error: 'Ingest user not configured',
      errorCode: 'SERVER_CONFIG_ERROR',
      suggestion: 'Set SMS_INGEST_USER_ID (ObjectId) or SMS_INGEST_USER_EMAIL on the server.',
      requestId: req.requestId,
    });
    return null;
  }
  return userId;
}
