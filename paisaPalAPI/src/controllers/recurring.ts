import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb';
import RecurringTransaction from '../models/RecurringTransaction';
import Transaction from '../models/Transaction';
import type { RecurringRuleInput, RecurringRuleUpdateInput } from '../schemas';
import { createAuditLog } from '../lib/audit';
import {
  calculateNextDueDate,
  toIstDateKey,
  istStartOfDayUtc,
} from '../lib/recurringUtils';
import type { Frequency } from '../lib/recurringUtils';

// Helpers to map between RecurringTransaction (source of truth) and RecurringRule-like responses
function toRuleLike(doc: {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  particulars?: string;
  amount: number;
  category: string;
  mode: string;
  frequency: string;
  dayOfMonth?: number;
  dayOfWeek?: number;
  startDate: Date;
  endDate?: Date;
  nextDueDate: Date;
  status: string;
  autoGenerate?: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    _id: doc._id.toString(),
    userId: doc.userId.toString(),
    name: doc.name,
    particulars: doc.particulars ?? doc.name,
    amount: doc.amount,
    category: doc.category,
    mode: doc.mode,
    frequency: doc.frequency,
    dayOfMonth: doc.dayOfMonth,
    dayOfWeek: doc.dayOfWeek,
    startDate: doc.startDate,
    endDate: doc.endDate,
    nextDue: doc.nextDueDate,
    isActive: doc.status === 'active' && (doc.autoGenerate ?? false),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function parseIstDate(value: string | Date) {
  if (value instanceof Date) {
    return istStartOfDayUtc(value);
  }
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 330 * 60 * 1000);
}

export async function listRecurringRules(req: Request, res: Response) {
  await connectDB();

  const userId = req.user!.userId;

  // Return only items with autoGenerate=true to preserve legacy behavior, sorted by nextDue
  const items = await RecurringTransaction.find({ userId, autoGenerate: true })
    .sort({ nextDueDate: 1 })
    .lean();

  return res.status(200).json({
    data: items.map((item) => toRuleLike(item as unknown as Parameters<typeof toRuleLike>[0])),
    error: null,
  });
}

export async function getRecurringRule(req: Request, res: Response) {
  await connectDB();

  const userId = new mongoose.Types.ObjectId(req.user!.userId);
  const item = await RecurringTransaction.findOne({
    _id: req.params.id,
    userId,
    autoGenerate: true,
  }).lean();

  if (!item) {
    return res.status(404).json({
      data: null,
      error: 'Recurring rule not found',
      errorCode: 'RECURRING_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  return res.status(200).json({
    data: toRuleLike(item as unknown as Parameters<typeof toRuleLike>[0]),
    error: null,
  });
}

export async function createRecurringRule(req: Request, res: Response) {
  await connectDB();

  const body = req.body as RecurringRuleInput;
  const userId = req.user!.userId;

  const startDate = parseIstDate(body.startDate);
  const endDate = body.endDate ? parseIstDate(body.endDate) : undefined;

  // Build a frequency value that satisfies Frequency union including biweekly
  const frequency = (body.frequency === 'daily'
    ? 'daily'
    : body.frequency === 'weekly'
      ? 'weekly'
      : body.frequency === 'monthly'
        ? 'monthly'
        : body.frequency === 'yearly'
          ? 'yearly'
          : 'monthly') as Frequency;

  const nextDue = calculateNextDueDate(frequency, startDate, startDate);

  const doc = await RecurringTransaction.create({
    name: body.name,
    particulars: body.particulars ?? body.name,
    amount: body.amount,
    category: body.category,
    mode: body.mode ?? 'Online',
    frequency,
    dayOfMonth: body.dayOfMonth,
    dayOfWeek: body.dayOfWeek,
    startDate,
    ...(endDate ? { endDate } : {}),
    nextDueDate: nextDue,
    status: 'active',
    autoGenerate: true,
    autoDetected: false,
    occurrences: 0,
    totalPaid: 0,
    userId,
  });

  createAuditLog({
    userId,
    action: 'CREATE',
    resource: 'recurring',
    resourceId: doc._id.toString(),
    after: toRuleLike(doc.toObject() as unknown as Parameters<typeof toRuleLike>[0]) as unknown as Record<string, unknown>,
    req,
  });

  return res.status(201).json({
    data: toRuleLike(doc.toObject() as unknown as Parameters<typeof toRuleLike>[0]),
    error: null,
    message: 'Recurring rule created',
  });
}

export async function updateRecurringRule(req: Request, res: Response) {
  await connectDB();

  const body = req.body as RecurringRuleUpdateInput;
  const userId = new mongoose.Types.ObjectId(req.user!.userId);

  const existing = await RecurringTransaction.findOne({
    _id: req.params.id,
    userId,
    autoGenerate: true,
  });

  if (!existing) {
    return res.status(404).json({
      data: null,
      error: 'Recurring rule not found',
      errorCode: 'RECURRING_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  const before = existing.toObject() as unknown as Record<string, unknown>;

  if (body.name !== undefined) existing.name = body.name;
  if (body.particulars !== undefined) existing.particulars = body.particulars;
  if (body.amount !== undefined) existing.amount = body.amount;
  if (body.category !== undefined) existing.category = body.category;
  if (body.mode !== undefined) existing.mode = body.mode;
  if (body.frequency !== undefined) existing.frequency = body.frequency as Frequency;
  if (body.dayOfMonth !== undefined) existing.dayOfMonth = body.dayOfMonth;
  if (body.dayOfWeek !== undefined) existing.dayOfWeek = body.dayOfWeek;
  if (body.startDate !== undefined) existing.startDate = parseIstDate(body.startDate);
  if (body.endDate !== undefined) existing.endDate = parseIstDate(body.endDate);
  if (body.isActive !== undefined) existing.status = body.isActive ? 'active' : 'paused';

  // Recalculate next due if frequency-related fields changed
  if (body.frequency || body.dayOfMonth !== undefined || body.dayOfWeek !== undefined) {
    const base = existing.lastPaidDate ?? existing.startDate;
    existing.nextDueDate = calculateNextDueDate(existing.frequency as Frequency, base, existing.startDate);
  }

  await existing.save();

  createAuditLog({
    userId: userId.toString(),
    action: 'UPDATE',
    resource: 'recurring',
    resourceId: req.params.id,
    before,
    after: toRuleLike(existing.toObject() as unknown as Parameters<typeof toRuleLike>[0]) as unknown as Record<string, unknown>,
    req,
  });

  return res.status(200).json({
    data: toRuleLike(existing.toObject() as unknown as Parameters<typeof toRuleLike>[0]),
    error: null,
  });
}

export async function deleteRecurringRule(req: Request, res: Response) {
  await connectDB();

  const userId = new mongoose.Types.ObjectId(req.user!.userId);

  const existing = await RecurringTransaction.findOne({
    _id: req.params.id,
    userId,
    autoGenerate: true,
  });

  if (!existing) {
    return res.status(404).json({
      data: null,
      error: 'Recurring rule not found',
      errorCode: 'RECURRING_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  const before = existing.toObject() as unknown as Record<string, unknown>;
  existing.status = 'ended';
  await existing.save();

  createAuditLog({
    userId: userId.toString(),
    action: 'DELETE',
    resource: 'recurring',
    resourceId: before._id?.toString() ?? req.params.id,
    before,
    req,
  });

  return res.status(200).json({
    data: null,
    error: null,
    message: 'Recurring rule deleted',
  });
}

export async function previewRecurringRule(req: Request, res: Response) {
  await connectDB();

  const count = parseInt(req.query.count as string) || 5;
  const body = req.body as RecurringRuleInput;

  const startDate = parseIstDate(body.startDate);
  const endDate = body.endDate ? parseIstDate(body.endDate) : undefined;

  // Build a frequency value that satisfies Frequency union including biweekly
  const frequency = (body.frequency === 'daily'
    ? 'daily'
    : body.frequency === 'weekly'
      ? 'weekly'
      : body.frequency === 'monthly'
        ? 'monthly'
        : body.frequency === 'yearly'
          ? 'yearly'
          : 'monthly') as Frequency;

  const occurrences: Date[] = [];

  // First occurrence is the start date itself
  if (!endDate || startDate <= endDate) {
    occurrences.push(startDate);
  }

  // Calculate subsequent occurrences
  let current = startDate;
  while (occurrences.length < count) {
    const next = calculateNextDueDate(frequency, current, startDate);

    if (endDate && next > endDate) {
      break;
    }

    occurrences.push(next);
    current = next;
  }

  return res.status(200).json({
    data: {
      rule: body,
      nextOccurrences: occurrences,
    },
    error: null,
  });
}

export async function runRecurringRules(req: Request, res: Response) {
  await connectDB();

  const userId = req.user!.userId;
  const dryRun = req.query.dryRun === 'true';

  const now = new Date();
  const today = istStartOfDayUtc(now);

  const filter: Record<string, unknown> = {
    userId,
    autoGenerate: true,
    status: 'active',
    nextDueDate: { $lte: today },
    $or: [{ endDate: { $exists: false } }, { endDate: { $gte: today } }],
  };

  const items = await RecurringTransaction.find(filter);

  const result = {
    created: 0,
    skipped: 0,
    transactions: [] as Array<{
      ruleId: string;
      ruleName: string;
      particulars: string;
      amount: number;
      category: string;
      date: Date;
    }>,
  };

  for (const item of items) {
    const transactionData: Record<string, unknown> = {
      date: item.nextDueDate,
      particulars: item.particulars ?? item.name,
      amount: item.amount,
      category: item.category,
      mode: item.mode,
      notes: item.notes || `Generated from recurring rule: ${item.name}`,
      userId,
    };

    result.transactions.push({
      ruleId: item._id.toString(),
      ruleName: item.name,
      particulars: item.particulars ?? item.name,
      amount: item.amount,
      category: item.category,
      date: item.nextDueDate,
    });

    if (!dryRun) {
      await Transaction.create({
        ...transactionData,
        dateKey: toIstDateKey(item.nextDueDate),
      });

      const nextDue = calculateNextDueDate(
        item.frequency as Frequency,
        item.nextDueDate,
        item.startDate,
      );

      item.lastPaidDate = item.nextDueDate;
      item.occurrences += 1;
      item.totalPaid += item.amount;
      item.nextDueDate = nextDue;

      if (item.endDate && nextDue > item.endDate) {
        item.status = 'ended';
      }

      await item.save();
    }

    result.created++;
  }

  return res.status(200).json({
    data: result,
    error: null,
    message: dryRun ? 'Preview completed' : `${result.created} transactions created`,
  });
}
