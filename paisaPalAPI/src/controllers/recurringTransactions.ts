import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb';
import RecurringTransaction from '../models/RecurringTransaction';
import Transaction from '../models/Transaction';
import type {
  ConfirmDetectedRecurringInput,
  RecurringMarkPaidInput,
  RecurringTransactionCreateInput,
  RecurringTransactionUpdateInput,
} from '../schemas';
import {
  calculateNextDueDate,
  getDaysUntilDue,
  getProjectedMonthly,
  getProjectedYearly,
  type Frequency,
} from '../lib/recurringUtils';
import { createAuditLog } from '../lib/audit';
import { detectRecurring } from '../lib/detectRecurring';

function toIstDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function parseStatus(value: unknown): 'active' | 'paused' | 'ended' | undefined {
  if (value === 'active' || value === 'paused' || value === 'ended') return value;
  return undefined;
}

export async function listRecurringTransactions(req: Request, res: Response) {
  await connectDB();
  const userId = req.user!.userId;

  const status = parseStatus(req.query.status);
  const filter: Record<string, unknown> = { userId };
  if (status) filter.status = status;

  const items = await RecurringTransaction.find(filter)
    .sort({ nextDueDate: 1 })
    .lean();

  const enriched = items.map((r) => {
    const frequency = r.frequency as Frequency;
    return {
      ...r,
      daysUntilDue: getDaysUntilDue(r.nextDueDate),
      projectedMonthly: getProjectedMonthly(r.amount, frequency),
      projectedYearly: getProjectedYearly(r.amount, frequency),
    };
  });

  return res.status(200).json({ data: enriched, error: null });
}

export async function createRecurringTransaction(req: Request, res: Response) {
  await connectDB();
  const body = req.body as RecurringTransactionCreateInput;
  const userId = req.user!.userId;

  const start = body.startDate;
  const nextDueDate = calculateNextDueDate(body.frequency as Frequency, start, start);

  const created = await RecurringTransaction.create({
    userId,
    name: body.name,
    amount: body.amount,
    category: body.category,
    mode: body.mode,
    notes: body.notes,
    frequency: body.frequency,
    startDate: start,
    ...(body.endDate ? { endDate: body.endDate } : {}),
    nextDueDate,
    status: 'active',
    autoDetected: false,
    occurrences: 0,
    totalPaid: 0,
  });

  createAuditLog({
    userId,
    action: 'CREATE',
    resource: 'recurring_transaction',
    resourceId: created._id.toString(),
    after: created.toObject() as unknown as Record<string, unknown>,
    req,
  });

  return res.status(201).json({ data: created, error: null });
}

export async function updateRecurringTransaction(req: Request, res: Response) {
  await connectDB();
  const body = req.body as RecurringTransactionUpdateInput;
  const userId = req.user!.userId;

  const existing = await RecurringTransaction.findOne({ _id: req.params.id, userId, status: { $ne: 'ended' } });
  if (!existing) {
    return res.status(404).json({
      data: null,
      error: 'Recurring transaction not found',
      errorCode: 'RECURRING_TX_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  const before = existing.toObject() as unknown as Record<string, unknown>;

  if (body.name !== undefined) existing.name = body.name;
  if (body.amount !== undefined) existing.amount = body.amount;
  if (body.category !== undefined) existing.category = body.category;
  if (body.mode !== undefined) existing.mode = body.mode;
  if (body.notes !== undefined) existing.notes = body.notes;
  if (body.frequency !== undefined) existing.frequency = body.frequency as Frequency;
  if (body.startDate !== undefined) existing.startDate = body.startDate;
  if (body.endDate !== undefined) existing.endDate = body.endDate;

  const base = existing.lastPaidDate ?? existing.startDate;
  existing.nextDueDate = calculateNextDueDate(existing.frequency as Frequency, base, existing.startDate);

  await existing.save();

  createAuditLog({
    userId,
    action: 'UPDATE',
    resource: 'recurring_transaction',
    resourceId: existing._id.toString(),
    before,
    after: existing.toObject() as unknown as Record<string, unknown>,
    req,
  });

  return res.status(200).json({ data: existing, error: null });
}

export async function deleteRecurringTransaction(req: Request, res: Response) {
  await connectDB();
  const userId = req.user!.userId;

  const existing = await RecurringTransaction.findOne({ _id: req.params.id, userId, status: { $ne: 'ended' } });
  if (!existing) {
    return res.status(404).json({
      data: null,
      error: 'Recurring transaction not found',
      errorCode: 'RECURRING_TX_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  const before = existing.toObject() as unknown as Record<string, unknown>;
  existing.status = 'ended';
  await existing.save();

  createAuditLog({
    userId,
    action: 'DELETE',
    resource: 'recurring_transaction',
    resourceId: existing._id.toString(),
    before,
    after: existing.toObject() as unknown as Record<string, unknown>,
    req,
  });

  return res.status(200).json({ data: null, error: null });
}

export async function markRecurringPaid(req: Request, res: Response) {
  await connectDB();
  const body = req.body as RecurringMarkPaidInput;
  const userId = req.user!.userId;

  const recurring = await RecurringTransaction.findOne({ _id: req.params.id, userId });
  if (!recurring) {
    return res.status(404).json({
      data: null,
      error: 'Recurring transaction not found',
      errorCode: 'RECURRING_TX_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  const paidDate = body.date ?? new Date();
  const paidAmount = body.amount ?? recurring.amount;

  const createdTx = await Transaction.create({
    userId,
    date: paidDate,
    dateKey: toIstDateKey(paidDate),
    particulars: recurring.name,
    amount: paidAmount,
    category: recurring.category,
    mode: recurring.mode,
    notes: recurring.notes ?? '',
  });

  recurring.lastPaidDate = paidDate;
  recurring.occurrences += 1;
  recurring.totalPaid += paidAmount;
  recurring.nextDueDate = calculateNextDueDate(
    recurring.frequency as Frequency,
    paidDate,
    recurring.startDate,
  );

  if (recurring.endDate && recurring.nextDueDate > recurring.endDate) {
    recurring.status = 'ended';
  }

  await recurring.save();

  createAuditLog({
    userId,
    action: 'CREATE',
    resource: 'transaction',
    resourceId: createdTx._id.toString(),
    after: createdTx.toObject() as unknown as Record<string, unknown>,
    req,
  });

  createAuditLog({
    userId,
    action: 'UPDATE',
    resource: 'recurring_transaction',
    resourceId: recurring._id.toString(),
    after: recurring.toObject() as unknown as Record<string, unknown>,
    req,
  });

  return res.status(200).json({
    data: { recurring, transaction: createdTx },
    error: null,
  });
}

export async function detectRecurringTransactions(req: Request, res: Response) {
  await connectDB();
  const userId = new mongoose.Types.ObjectId(req.user!.userId);

  const txs = await Transaction.find({ userId })
    .select({ particulars: 1, amount: 1, category: 1, date: 1 })
    .lean();

  const suggestions = detectRecurring(
    txs.map((t) => ({
      _id: t._id,
      particulars: t.particulars,
      amount: t.amount,
      category: t.category,
      date: t.date,
    })),
  );

  return res.status(200).json({ data: { suggestions }, error: null });
}

export async function confirmDetectedRecurring(req: Request, res: Response) {
  await connectDB();
  const userId = req.user!.userId;

  const body = req.body as ConfirmDetectedRecurringInput;
  const created: unknown[] = [];

  for (const s of body.suggestions ?? []) {
    const startDate = new Date(s.suggestedNextDate);
    const nextDueDate = calculateNextDueDate(s.frequency, startDate, startDate);
    const doc = await RecurringTransaction.create({
      userId,
      name: s.name,
      amount: s.amount,
      category: s.category,
      mode: 'Online',
      frequency: s.frequency,
      startDate,
      nextDueDate,
      status: 'active',
      autoDetected: true,
      occurrences: 0,
      totalPaid: 0,
    });
    created.push(doc);
  }

  return res.status(201).json({ data: { created }, error: null });
}
