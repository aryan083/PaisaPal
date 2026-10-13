import type { Request, Response } from 'express';

import {
  contentHash,
  getIngestSecret,
  getProvidedIngestSecret,
  resolveIngestUserId,
  shiftDateKey,
} from '../lib/ingestAuth';
import { connectDB } from '../lib/mongodb';
import { parseReceiptEmail } from '../lib/receiptParser';
import AppReceipt from '../models/AppReceipt';
import Transaction from '../models/Transaction';

/** Amount window for app receipts: e-commerce UPI charges are exact. */
const AMOUNT_TOLERANCE = 2;

/**
 * POST /api/ingest/receipt — shopping/food receipt (email subject + body).
 * Same ingest-secret auth. NEVER creates a Transaction (bank = truth):
 * stores the receipt and links it to the closest bank debit
 * (±1 day, ±₹2). Unmatched receipts wait as pending_bank.
 */
export async function ingestReceipt(req: Request, res: Response) {
  await connectDB();

  const configured = getIngestSecret();
  if (!configured) {
    return res.status(500).json({
      data: null,
      error: 'Ingest not configured',
      errorCode: 'SERVER_CONFIG_ERROR',
      suggestion: 'Set SMS_INGEST_SECRET (>=16 chars) and SMS_INGEST_USER_ID or SMS_INGEST_USER_EMAIL on the server.',
      requestId: req.requestId,
    });
  }

  const provided = getProvidedIngestSecret(req);
  if (!provided || provided !== configured) {
    return res.status(401).json({
      data: null,
      error: 'Invalid ingest secret',
      errorCode: 'INGEST_UNAUTHORIZED',
      suggestion: 'Check x-ingest-secret matches the server secret.',
      requestId: req.requestId,
    });
  }

  const userId = await resolveIngestUserId();
  if (!userId) {
    return res.status(500).json({
      data: null,
      error: 'Ingest user not configured',
      errorCode: 'SERVER_CONFIG_ERROR',
      suggestion: 'Set SMS_INGEST_USER_ID (ObjectId) or SMS_INGEST_USER_EMAIL on the server.',
      requestId: req.requestId,
    });
  }

  const { app, subject, body, receivedAt } = req.body as {
    app?: string;
    subject: string;
    body: string;
    receivedAt?: Date;
  };

  const hash = contentHash(`${app ?? ''}\n${subject}`, body);

  const existing = await AppReceipt.findOne({ userId, receiptHash: hash }).lean();
  if (existing) {
    return res.status(200).json({
      data: {
        status: 'duplicate' as const,
        reason: 'same receipt already processed',
        receiptDbId: existing._id.toString(),
        linkedTransactionId: existing.linkedTransactionId?.toString() ?? null,
      },
      error: null,
      message: 'Duplicate receipt ignored',
    });
  }

  const parsed = parseReceiptEmail(
    { app, subject, body },
    receivedAt instanceof Date ? receivedAt : undefined,
  );

  if (!parsed) {
    const row = await AppReceipt.create({
      userId,
      receiptHash: hash,
      app: (app ?? 'GENERIC').toUpperCase().slice(0, 32),
      subject: subject.slice(0, 300),
      body: body.slice(0, 8000),
      orderDateKey: null,
      amount: null,
      orderId: null,
      linkedTransactionId: null,
      variance: null,
      status: 'needs_review',
      parseError: 'No amount found — not a receipt or unsupported format.',
    });
    return res.status(200).json({
      data: {
        status: 'needs_review' as const,
        reason: 'Could not parse — saved for review (promo emails land here; tighten your Shortcut subject filter).',
        receiptDbId: row._id.toString(),
        linkedTransactionId: null,
        parsed: null,
      },
      error: null,
      message: 'Receipt needs review',
    });
  }

  const low = shiftDateKey(parsed.dateKey, -1);
  const high = shiftDateKey(parsed.dateKey, 1);
  const candidates = await Transaction.find({
    userId,
    dateKey: { $gte: low, $lte: high },
    amount: { $gte: parsed.amount - AMOUNT_TOLERANCE, $lte: parsed.amount + AMOUNT_TOLERANCE },
  })
    .limit(20)
    .lean();

  candidates.sort((a, b) => {
    const da = Math.abs(a.amount - parsed.amount);
    const db = Math.abs(b.amount - parsed.amount);
    if (da !== db) return da - db;
    return (a.dateKey === parsed.dateKey ? 0 : 1) - (b.dateKey === parsed.dateKey ? 0 : 1);
  });
  const match = candidates[0] ?? null;

  if (!match) {
    const row = await AppReceipt.create({
      userId,
      receiptHash: hash,
      app: parsed.app,
      subject: subject.slice(0, 300),
      body: body.slice(0, 8000),
      orderDateKey: parsed.dateKey,
      amount: parsed.amount,
      orderId: parsed.orderId,
      linkedTransactionId: null,
      variance: null,
      status: 'pending_bank',
      parseError: null,
    });
    return res.status(201).json({
      data: {
        status: 'pending_bank' as const,
        reason: 'No bank debit within ±1 day / ±₹2 yet — links when the SMS arrives.',
        receiptDbId: row._id.toString(),
        linkedTransactionId: null,
        variance: null,
        parsed,
      },
      error: null,
      message: 'Receipt stored, waiting for bank debit',
    });
  }

  const variance = Math.round((match.amount - parsed.amount) * 100) / 100;
  const row = await AppReceipt.create({
    userId,
    receiptHash: hash,
    app: parsed.app,
    subject: subject.slice(0, 300),
    body: body.slice(0, 8000),
    orderDateKey: parsed.dateKey,
    amount: parsed.amount,
    orderId: parsed.orderId,
    linkedTransactionId: match._id,
    variance,
    status: 'linked',
    parseError: null,
  });

  // Additive annotation only — never touch the bank amount.
  const noteAdd =
    `[${parsed.app} receipt Rs.${parsed.amount}${parsed.orderId ? ` #${parsed.orderId}` : ''}${variance !== 0 ? ` variance ${variance >= 0 ? '+' : ''}${variance}` : ''}]`.slice(0, 200);
  try {
    const current = await Transaction.findOne({ _id: match._id, userId }).lean();
    if (current) {
      const update: Record<string, unknown> = {
        notes: `${current.notes ?? ''} ${noteAdd}`.slice(0, 500),
      };
      if (current.category === 'Other') update.category = parsed.categoryGuess;
      await Transaction.updateOne({ _id: match._id, userId }, { $set: update });
    }
  } catch {
    // best-effort; link already stored
  }

  return res.status(201).json({
    data: {
      status: 'linked' as const,
      receiptDbId: row._id.toString(),
      linkedTransactionId: match._id.toString(),
      variance,
      parsed,
    },
    error: null,
    message: 'Receipt linked to bank debit',
  });
}
