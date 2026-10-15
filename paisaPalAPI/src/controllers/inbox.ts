import type { Request, Response } from 'express';
import mongoose from 'mongoose';

import { syncEnvelopeForTransaction } from '../lib/envelopeSync';
import { applyRapidoTaxContribution } from '../lib/rapidoTax';
import { connectDB } from '../lib/mongodb';
import type { InboxApproveInput, InboxQuery } from '../schemas';
import AppReceipt from '../models/AppReceipt';
import RapidoReceipt from '../models/RapidoReceipt';
import SmsInbox from '../models/SmsInbox';
import Settings from '../models/Settings';
import Transaction from '../models/Transaction';

type InboxKind = 'sms' | 'rapido' | 'receipt';
type Row = Record<string, any>;

// The three schemas intentionally have different row shapes; normalize them at
// this boundary rather than erasing their model typings throughout the ingest code.
const models: Record<InboxKind, any> = {
  sms: SmsInbox,
  rapido: RapidoReceipt,
  receipt: AppReceipt,
};

function istDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function notFound(res: Response, req: Request) {
  return res.status(404).json({
    data: null,
    error: 'Inbox item not found',
    errorCode: 'INBOX_NOT_FOUND',
    suggestion: 'Refresh the inbox and try again.',
    requestId: req.requestId,
  });
}

function rowDetails(kind: InboxKind, row: Row) {
  if (kind === 'rapido') {
    return { dateKey: row.rideDateKey, amount: row.rapidoAmount, title: row.subject, detail: row.receiptId ? `Ride ${row.receiptId}` : 'Rapido receipt', parsed: { receiptId: row.receiptId, claimedMode: row.claimedMode, parseError: row.parseError }, transactionId: row.linkedTransactionId?.toString() ?? null };
  }
  if (kind === 'receipt') {
    return { dateKey: row.orderDateKey, amount: row.amount, title: row.subject, detail: row.orderId ? `${row.app} order ${row.orderId}` : `${row.app} receipt`, parsed: { app: row.app, orderId: row.orderId, parseError: row.parseError }, transactionId: row.linkedTransactionId?.toString() ?? null };
  }
  return { dateKey: row.dateKey, amount: row.amount, title: row.sender, detail: row.direction ? `${row.sender} · ${row.direction}` : row.sender, parsed: { sender: row.sender, upiRef: row.upiRef, parseError: row.parseError }, transactionId: row.transactionId?.toString() ?? null };
}

function categoryGuess(kind: InboxKind, row: Row): string {
  if (kind === 'rapido') return 'Rapido';
  if (kind === 'receipt') {
    if (['AMAZON', 'FLIPKART', 'INSTAMART'].includes(row.app)) return 'Shopping';
    if (row.app === 'SWIGGY') return 'Food & Drinks';
  }
  return 'Other';
}

async function candidates(userId: string, dateKey: string | null, amount: number | null, tolerance: number) {
  if (!dateKey || amount === null) return [];
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const low = new Date(date); low.setUTCDate(low.getUTCDate() - 1);
  const high = new Date(date); high.setUTCDate(high.getUTCDate() + 1);
  return Transaction.find({
    userId,
    dateKey: { $gte: istDateKey(low), $lte: istDateKey(high) },
    amount: { $gte: amount - tolerance, $lte: amount + tolerance },
  }).sort({ dateKey: -1, amount: 1 }).limit(8).lean();
}

async function normalize(kind: InboxKind, row: Row, userId: string) {
  const details = rowDetails(kind, row);
  return {
    kind,
    id: row._id.toString(),
    status: row.status,
    ...details,
    variance: row.variance ?? null,
    rawExcerpt: (row.body ?? '').slice(0, 700),
    createdAt: row.createdAt,
    candidates: ['pending_bank', 'needs_review'].includes(row.status)
      ? await candidates(userId, details.dateKey, details.amount, kind === 'rapido' ? 10 : 2)
      : [],
  };
}

export async function listInbox(req: Request, res: Response) {
  await connectDB();
  const userId = req.user!.userId;
  const query = req.query as unknown as InboxQuery;
  const kinds: InboxKind[] = query.kind ? [query.kind] : ['sms', 'rapido', 'receipt'];
  const filterStatus = query.status === 'actionable' ? { $in: ['pending_bank', 'needs_review'] } : query.status;
  const groups = await Promise.all(kinds.map(async kind => {
    const filter: Record<string, unknown> = { userId };
    if (filterStatus) filter.status = filterStatus;
    const rows = await models[kind].find(filter).sort({ createdAt: -1 }).lean();
    return Promise.all(rows.map((row: Row) => normalize(kind, row, userId)));
  }));
  const all = groups.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / query.limit));
  const start = (query.page - 1) * query.limit;
  return res.status(200).json({ data: { items: all.slice(start, start + query.limit), total, page: query.page, pages }, error: null });
}

function annotation(kind: InboxKind, row: Row, variance: number) {
  const { amount } = rowDetails(kind, row);
  if (kind === 'rapido') return `[Rapido receipt Rs.${amount}${variance ? ` variance ${variance >= 0 ? '+' : ''}${variance}` : ''}${row.claimedMode && row.claimedMode !== 'UNKNOWN' ? ` (receipt claimed ${row.claimedMode}, bank wins)` : ''}${row.receiptId ? ` #${row.receiptId}` : ''}]`;
  if (kind === 'receipt') return `[${row.app} receipt Rs.${amount}${row.orderId ? ` #${row.orderId}` : ''}${variance ? ` variance ${variance >= 0 ? '+' : ''}${variance}` : ''}]`;
  return `[SMS ${row.sender}${row.upiRef ? ` #${row.upiRef}` : ''}]`;
}

async function linkRow(kind: InboxKind, row: Row, transaction: Row, userId: string) {
  const details = rowDetails(kind, row);
  const variance = details.amount === null ? null : Math.round((transaction.amount - details.amount) * 100) / 100;
  const note = annotation(kind, row, variance ?? 0).slice(0, 200);
  const update: Record<string, unknown> = { notes: `${transaction.notes ?? ''} ${note}`.trim().slice(0, 500) };
  if (transaction.category === 'Other') update.category = categoryGuess(kind, row);
  await Transaction.updateOne({ _id: transaction._id, userId }, { $set: update });
  const fields = kind === 'sms'
    ? { transactionId: transaction._id, status: 'posted' }
    : { linkedTransactionId: transaction._id, variance, status: 'linked' };
  const updated = await models[kind].findOneAndUpdate({ _id: row._id, userId }, { $set: fields }, { new: true }).lean();
  return { row: updated, transaction: await Transaction.findById(transaction._id).lean() };
}

export async function approveInbox(req: Request, res: Response) {
  await connectDB();
  const kind = req.params.kind as InboxKind;
  const model = models[kind];
  const userId = req.user!.userId;
  const body = req.body as InboxApproveInput;
  if (!model || !mongoose.isValidObjectId(req.params.id)) return notFound(res, req);
  const row = await model.findOne({ _id: req.params.id, userId }).lean();
  if (!row) return notFound(res, req);

  if (body.action === 'dismiss') {
    const updated = await model.findOneAndUpdate({ _id: row._id, userId }, { $set: { status: 'dismissed' } }, { new: true }).lean();
    return res.status(200).json({ data: { item: await normalize(kind, updated, userId) }, error: null, message: 'Inbox item dismissed' });
  }
  if (body.action === 'link') {
    const transaction = await Transaction.findOne({ _id: body.transactionId, userId }).lean();
    if (!transaction) return notFound(res, req);
    const result = await linkRow(kind, row, transaction, userId);
    return res.status(200).json({ data: { item: await normalize(kind, result.row, userId), transaction: result.transaction }, error: null, message: 'Inbox item linked' });
  }

  const details = rowDetails(kind, row);
  const values = body.transaction ?? {};
  const date = values.date ?? (details.dateKey ? new Date(`${details.dateKey}T00:00:00.000Z`) : new Date());
  const claimedCash = kind === 'rapido' && row.claimedMode === 'Cash';
  const transaction = await Transaction.create({
    userId,
    date,
    dateKey: istDateKey(date),
    particulars: values.particulars ?? details.title ?? (kind === 'rapido' ? 'Rapido ride' : 'Receipt expense'),
    amount: values.amount ?? details.amount ?? 0,
    category: values.category ?? categoryGuess(kind, row),
    modes: values.modes ?? (claimedCash ? ['Cash'] : ['Online']),
    notes: values.notes ?? annotation(kind, row, 0).slice(0, 500),
  });
  const result = await linkRow(kind, row, transaction.toObject(), userId);
  void (async () => {
    try {
      const settings = await Settings.findOne({ userId }).lean();
      await syncEnvelopeForTransaction(userId, transaction.date, transaction.category, settings?.envelopeWarningThreshold ?? 80);
      if (transaction.category === 'Rapido') await applyRapidoTaxContribution({ userId, amount: transaction.amount, transactionId: transaction._id.toString() });
    } catch { /* best effort */ }
  })();
  return res.status(201).json({ data: { item: await normalize(kind, result.row, userId), transaction: result.transaction }, error: null, message: 'Transaction created and linked' });
}
