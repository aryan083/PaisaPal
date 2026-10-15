import type { Request, Response } from 'express';

import {
  authorizeIngest,
  contentHash,
  shiftDateKey,
} from '../lib/ingestAuth';
import { stripToText } from '../lib/htmlText';
import { connectDB } from '../lib/mongodb';
import { syncEnvelopeForTransaction } from '../lib/envelopeSync';
import { parseRapidoEmail, type ParsedRapidoReceipt } from '../lib/rapidoParser';
import { extractText as extractPdfTextContent } from 'unpdf';
import { parseSms } from '../lib/smsParser';
import RapidoReceipt from '../models/RapidoReceipt';
import SmsInbox from '../models/SmsInbox';
import Transaction from '../models/Transaction';

export async function ingestSms(req: Request, res: Response) {
  await connectDB();

  const userId = await authorizeIngest(req, res);
  if (!userId) return;

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

  const userId = await authorizeIngest(req, res);
  if (!userId) return;

  const { subject, body, receivedAt } = req.body as {
    subject: string;
    body: string;
    receivedAt?: Date;
  };

  // Strip HTML/QP to plain text up front: stored + hashed form is small
  // (≤8000, fits the model) and encoding-insensitive (same invoice as HTML
  // vs text dedups to one row).
  const cleanBody = stripToText(body).slice(0, 8000);

  const hash = contentHash(subject, cleanBody);

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
      body: cleanBody,
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
      body: cleanBody,
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
    body: cleanBody,
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

type RapidoReconcileOutcome = {
  httpStatus: 200 | 201;
  response: { data: unknown; error: null; message: string };
};

/**
 * Shared store + bank-link flow for a parsed Rapido receipt, whatever carrier
 * delivered it (email HTML body or invoice PDF text). Bank debit stays payment
 * truth: never creates a Transaction, only stores the receipt and links it
 * (±1 day, ±₹10) with additive annotation.
 */
async function reconcileParsedRapido(args: {
  userId: string;
  hash: string;
  subject: string;
  storeBody: string;
  parsed: ParsedRapidoReceipt | null;
  unparsedReason: string;
}): Promise<RapidoReconcileOutcome> {
  const { userId, hash, subject, storeBody, parsed, unparsedReason } = args;

  if (!parsed) {
    const row = await RapidoReceipt.create({
      userId,
      receiptHash: hash,
      subject: subject.slice(0, 300),
      body: storeBody,
      rideDateKey: null,
      rapidoAmount: null,
      claimedMode: null,
      receiptId: null,
      linkedTransactionId: null,
      variance: null,
      status: 'needs_review',
      parseError: unparsedReason,
    });
    return {
      httpStatus: 200,
      response: {
        data: {
          status: 'needs_review' as const,
          reason: 'Could not parse — saved for review.',
          receiptDbId: row._id.toString(),
          linkedTransactionId: null,
          parsed: null,
        },
        error: null,
        message: 'Receipt needs review',
      },
    };
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
      body: storeBody,
      rideDateKey: rideKey,
      rapidoAmount: parsed.rapidoAmount,
      claimedMode: parsed.claimedMode,
      receiptId: parsed.receiptId,
      linkedTransactionId: null,
      variance: null,
      status: 'pending_bank',
      parseError: null,
    });
    return {
      httpStatus: 201,
      response: {
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
      },
    };
  }

  const variance = Math.round((match.amount - parsed.rapidoAmount) * 100) / 100;

  const row = await RapidoReceipt.create({
    userId,
    receiptHash: hash,
    subject: subject.slice(0, 300),
    body: storeBody,
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

  return {
    httpStatus: 201,
    response: {
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
    },
  };
}

/** 1MB decoded cap: invoice PDFs are ~300KB; anything bigger is not an invoice. */
const MAX_PDF_BYTES = 1024 * 1024;

/**
 * Plain text of an invoice PDF. Exported for tests.
 *
 * Uses unpdf (pure JS, no native canvas/DOM deps) instead of pdf-parse:
 * pdf-parse v2 requires DOMMatrix/@napi-rs/canvas, which Vercel's serverless
 * Node runtime lacks — its top-level import crashed every /api route at boot.
 */
export async function extractRapidoPdfText(buf: Buffer): Promise<string> {
  const { text } = await extractPdfTextContent(new Uint8Array(buf));
  if (Array.isArray(text)) return text.join('\n');
  return text ?? '';
}

/**
 * POST /api/ingest/rapido-pdf — Rapido invoice PDF as base64 (iPhone Shortcut:
 * Email Attachments → Base64 encode → pdfBase64, typed subject). Apple Mail's
 * Shortcuts Content is empty for HTML-only mail, but the PDF attachment
 * carries everything. Same store + bank-link flow as /api/ingest/rapido.
 */
export async function ingestRapidoPdf(req: Request, res: Response) {
  await connectDB();

  const userId = await authorizeIngest(req, res);
  if (!userId) return;

  const { subject, pdfBase64 } = req.body as { subject: string; pdfBase64: string };

  if (!/^[A-Za-z0-9+/=\s]+$/.test(pdfBase64)) {
    return res.status(400).json({
      data: null,
      error: 'Invalid PDF data',
      errorCode: 'PDF_INVALID',
      suggestion: 'Send the invoice PDF base64-encoded.',
      requestId: req.requestId,
    });
  }
  const buf = Buffer.from(pdfBase64, 'base64');
  // TEMP-PDF-DEBUG (remove after live verify): fingerprint what the phone
  // actually sent — base64 length + decoded magic bytes only, never content.
  // Real invoice PDF starts with 255044462d312e34 ("%PDF-1.4").
  try {
    console.log(
      `[ingest-pdf-debug] b64len=${pdfBase64.length} declen=${buf.length} magic=${buf.subarray(0, 8).toString('hex')} b64prefix=${pdfBase64.slice(0, 24)}`,
    );
  } catch {
    // logging must never break ingestion
  }
  if (buf.length === 0 || buf.length > MAX_PDF_BYTES) {
    return res.status(400).json({
      data: null,
      error: 'PDF too large or empty',
      errorCode: 'PDF_TOO_LARGE',
      suggestion: 'Send a single invoice PDF (max 1MB decoded).',
      requestId: req.requestId,
    });
  }

  let text: string;
  try {
    text = await extractRapidoPdfText(buf);
  } catch {
    return res.status(400).json({
      data: null,
      error: 'Could not read PDF',
      errorCode: 'PDF_UNREADABLE',
      suggestion: 'Send a valid invoice PDF.',
      requestId: req.requestId,
    });
  }

  const storeBody = stripToText(text).slice(0, 8000);
  const hash = contentHash(subject, storeBody);
  const parsed = text.trim() ? parseRapidoEmail(subject, text) : null;

  // Replay-safe: same PDF twice → same row, no second link.
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

  const out = await reconcileParsedRapido({
    userId,
    hash,
    subject,
    storeBody,
    parsed,
    unparsedReason: 'PDF had no readable Rapido text.',
  });
  return res.status(out.httpStatus).json(out.response);
}
