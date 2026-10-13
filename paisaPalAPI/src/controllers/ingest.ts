import type { Request, Response } from 'express';

import {
  contentHash,
  getIngestSecret,
  getProvidedIngestSecret,
  resolveIngestUserId,
  shiftDateKey,
} from '../lib/ingestAuth';
import { connectDB } from '../lib/mongodb';
import { syncEnvelopeForTransaction } from '../lib/envelopeSync';
import { parseRapidoEmail } from '../lib/rapidoParser';
import { parseSms } from '../lib/smsParser';
import RapidoReceipt from '../models/RapidoReceipt';
import SmsInbox from '../models/SmsInbox';
import Transaction from '../models/Transaction';

export async function ingestSms(req: Request, res: Response) {
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
      suggestion: 'Check x-ingest-secret in your iPhone Shortcut matches the server secret.',
      requestId: req.requestId,
    });
  }

  const userId = await resolveIngestUserId();
  if (!userId) {
    return res.status(500).json({
      data: null,
      error: 'Ingest user not configured',
      errorCode: 'SERVER_CONFIG_ERROR',
      suggestion: 'Set SMS_INGEST_USER_ID (ObjectId) or SMS_INGEST_USER_EMAIL (existing user email) on the server.',
      requestId: req.requestId,
    });
  }

  const { sender, body, receivedAt } = req.body as {
    sender: string;
    body: string;
    receivedAt?: Date;
  };

  const hash = contentHash(sender, body);

  // Replay-safe: same SMS twice → same inbox row, no second Transaction.
  const existingInbox = await SmsInbox.findOne({ userId, bodyHash: hash }).lean();
  if (existingInbox) {
    return res.status(200).json({
      data: {
        status: 'duplicate' as const,
        reason: 'same SMS body already processed',
        inboxId: existingInbox._id.toString(),
        transactionId: existingInbox.transactionId?.toString() ?? null,
      },
      error: null,
      message: 'Duplicate SMS ignored',
    });
  }

  const parsed = parseSms(sender, body, receivedAt instanceof Date ? receivedAt : undefined);

  if (!parsed) {
    const inbox = await SmsInbox.create({
      userId,
      bodyHash: hash,
      sender: sender.slice(0, 64),
      body: body.slice(0, 2000),
      direction: null,
      amount: null,
      dateKey: null,
      upiRef: null,
      status: 'needs_review',
      transactionId: null,
      parseError: 'No amount found — not a transaction alert or unsupported format.',
    });
    return res.status(200).json({
      data: {
        status: 'needs_review' as const,
        reason: 'Could not parse — saved to inbox for review.',
        inboxId: inbox._id.toString(),
        transactionId: null,
        parsed: null,
      },
      error: null,
      message: 'SMS needs review',
    });
  }

  // Second dedup layer: same (dateKey, narration, amount) already posted
  // (e.g. SMS arrived after a manual entry or CSV import).
  const existingTx = await Transaction.findOne({
    userId,
    dateKey: parsed.dateKey,
    particulars: parsed.narration,
    amount: parsed.amount,
  })
    .select('_id')
    .lean();

  if (existingTx) {
    const inbox = await SmsInbox.create({
      userId,
      bodyHash: hash,
      sender: sender.slice(0, 64),
      body: body.slice(0, 2000),
      direction: parsed.direction,
      amount: parsed.amount,
      dateKey: parsed.dateKey,
      upiRef: parsed.upiRef,
      status: 'duplicate',
      transactionId: existingTx._id,
      parseError: null,
    });
    return res.status(200).json({
      data: {
        status: 'duplicate' as const,
        reason: 'Matching transaction already exists for this date/narration/amount.',
        inboxId: inbox._id.toString(),
        transactionId: existingTx._id.toString(),
        parsed,
      },
      error: null,
      message: 'Duplicate transaction ignored',
    });
  }

  const notes = `[SMS ${sender.slice(0, 32)}${parsed.direction !== 'UNKNOWN' ? ` ${parsed.direction}` : ''}${parsed.upiRef ? ` Ref ${parsed.upiRef}` : ''}${parsed.balance !== null ? ` Bal Rs.${parsed.balance}` : ''}] ${body}`.slice(0, 500);

  const created = await Transaction.create({
    userId,
    date: parsed.date,
    dateKey: parsed.dateKey,
    particulars: parsed.narration,
    amount: parsed.amount,
    category: parsed.categoryGuess,
    modes: ['Online'],
    notes,
  });

  await SmsInbox.create({
    userId,
    bodyHash: hash,
    sender: sender.slice(0, 64),
    body: body.slice(0, 2000),
    direction: parsed.direction,
    amount: parsed.amount,
    dateKey: parsed.dateKey,
    upiRef: parsed.upiRef,
    status: 'posted',
    transactionId: created._id,
    parseError: null,
  });

  const inboxRow = await SmsInbox.findOne({ userId, bodyHash: hash }).select('_id').lean();

  // Same fire-and-forget envelope sync as manual create (best-effort).
  void (async () => {
    try {
      const Settings = (await import('../models/Settings')).default;
      const settings = await Settings.findOne({ userId }).lean();
      const threshold = settings?.envelopeWarningThreshold ?? 80;
      await syncEnvelopeForTransaction(userId, parsed.date, parsed.categoryGuess, threshold);
    } catch {
      // fire-and-forget
    }
  })();

  return res.status(201).json({
    data: {
      status: 'posted' as const,
      inboxId: inboxRow?._id.toString() ?? null,
      transactionId: created._id.toString(),
      parsed,
      transaction: created,
    },
    error: null,
    message: 'Transaction created from SMS',
  });
}

/**
 * POST /api/ingest/rapido — Rapido ride receipt (email subject + body).
 * Same ingest-secret auth as SMS. Bank debit stays payment truth:
 * this endpoint NEVER creates a Transaction — it stores the receipt and
 * links it to the closest bank Transaction (±1 day, ±₹10).
 */
export async function ingestRapido(req: Request, res: Response) {
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

  const { subject, body, receivedAt } = req.body as {
    subject: string;
    body: string;
    receivedAt?: Date;
  };

  const hash = contentHash(subject, body);

  const existing = await RapidoReceipt.findOne({ userId, receiptHash: hash }).lean();
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

  const parsed = parseRapidoEmail(subject, body, receivedAt instanceof Date ? receivedAt : undefined);

  if (!parsed) {
    const row = await RapidoReceipt.create({
      userId,
      receiptHash: hash,
      subject: subject.slice(0, 300),
      body: body.slice(0, 8000),
      rideDateKey: null,
      rapidoAmount: null,
      claimedMode: null,
      receiptId: null,
      linkedTransactionId: null,
      variance: null,
      status: 'needs_review',
      parseError: 'Not a Rapido receipt or no amount found.',
    });
    return res.status(200).json({
      data: {
        status: 'needs_review' as const,
        reason: 'Could not parse — saved for review.',
        receiptDbId: row._id.toString(),
        linkedTransactionId: null,
        parsed: null,
      },
      error: null,
      message: 'Receipt needs review',
    });
  }

  // Match bank Transaction: ±1 day dateKey window, amount within ±10.
  // Bank amount wins; receipt keeps original + variance (K4).
  const rideKey = parsed.dateKey;
  const low = shiftDateKey(rideKey, -1);
  const high = shiftDateKey(rideKey, 1);
  const candidates = await Transaction.find({
    userId,
    dateKey: { $gte: low, $lte: high },
    amount: { $gte: parsed.rapidoAmount - 10, $lte: parsed.rapidoAmount + 10 },
  })
    .sort({ amount: 1 })
    .limit(20)
    .lean();

  // Prefer closest amount, then same-day.
  candidates.sort((a, b) => {
    const da = Math.abs(a.amount - parsed.rapidoAmount);
    const db = Math.abs(b.amount - parsed.rapidoAmount);
    if (da !== db) return da - db;
    const sa = a.dateKey === rideKey ? 0 : 1;
    const sb = b.dateKey === rideKey ? 0 : 1;
    return sa - sb;
  });
  const match = candidates[0] ?? null;

  if (!match) {
    const row = await RapidoReceipt.create({
      userId,
      receiptHash: hash,
      subject: subject.slice(0, 300),
      body: body.slice(0, 8000),
      rideDateKey: rideKey,
      rapidoAmount: parsed.rapidoAmount,
      claimedMode: parsed.claimedMode,
      receiptId: parsed.receiptId,
      linkedTransactionId: null,
      variance: null,
      status: 'pending_bank',
      parseError: null,
    });
    return res.status(201).json({
      data: {
        status: 'pending_bank' as const,
        reason: 'No bank debit within ±1 day / ±₹10 yet — will link when the SMS arrives.',
        receiptDbId: row._id.toString(),
        linkedTransactionId: null,
        variance: null,
        parsed,
      },
      error: null,
      message: 'Receipt stored, waiting for bank debit',
    });
  }

  const variance = Math.round((match.amount - parsed.rapidoAmount) * 100) / 100;

  const row = await RapidoReceipt.create({
    userId,
    receiptHash: hash,
    subject: subject.slice(0, 300),
    body: body.slice(0, 8000),
    rideDateKey: rideKey,
    rapidoAmount: parsed.rapidoAmount,
    claimedMode: parsed.claimedMode,
    receiptId: parsed.receiptId,
    linkedTransactionId: match._id,
    variance,
    status: 'linked',
    parseError: null,
  });

  // Annotate the bank Transaction (additive only — never change amount):
  // bank mode wins over receipt's "Cash" claim (K3), keep both visible.
  const noteAdd =
    `[Rapido receipt Rs.${parsed.rapidoAmount}${variance !== 0 ? ` variance ${variance >= 0 ? '+' : ''}${variance}` : ''}${parsed.claimedMode !== 'UNKNOWN' ? ` (receipt claimed ${parsed.claimedMode}, bank wins)` : ''}${parsed.receiptId ? ` #${parsed.receiptId}` : ''}]`.slice(0, 200);
  try {
    const update: Record<string, unknown> = {};
    const current = await Transaction.findOne({ _id: match._id, userId }).lean();
    if (current) {
      const notes = `${current.notes ?? ''} ${noteAdd}`.slice(0, 500);
      update.notes = notes;
      if (current.category === 'Other') update.category = 'Rapido';
      await Transaction.updateOne({ _id: match._id, userId }, { $set: update });
    }
  } catch {
    // annotation is best-effort; link already stored
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
    message:
      variance === 0
        ? 'Receipt linked to bank debit'
        : `Receipt linked (bank differs by ${variance >= 0 ? '+' : ''}${variance} — kept both)`,
  });
}
