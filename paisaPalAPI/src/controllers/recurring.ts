import type { Request, Response } from 'express';
import { connectDB } from '../lib/mongodb';
import RecurringRule, { type IRecurringRule } from '../models/RecurringRule';
import type { RecurringRuleInput, RecurringRuleUpdateInput } from '../schemas';
import { calculateNextDueDate, materializeRecurringTransactions } from '../services/recurring.service';
import { createAuditLog } from '../lib/audit';

export async function listRecurringRules(req: Request, res: Response) {
  await connectDB();

  const userId = req.user!.userId;

  const rules = await RecurringRule.find({ userId })
    .sort({ nextDue: 1 })
    .lean();

  return res.status(200).json({
    data: rules,
    error: null,
  });
}

export async function getRecurringRule(req: Request, res: Response) {
  await connectDB();

  const userId = req.user!.userId;
  const rule = await RecurringRule.findOne({ _id: req.params.id, userId }).lean();

  if (!rule) {
    return res.status(404).json({
      data: null,
      error: 'Recurring rule not found',
      errorCode: 'RECURRING_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  return res.status(200).json({
    data: rule,
    error: null,
  });
}

export async function createRecurringRule(req: Request, res: Response) {
  await connectDB();

  const body = req.body as RecurringRuleInput;
  const userId = req.user!.userId;

  const parseIstDate = (value: string | Date) => {
    if (value instanceof Date) {
      const istKey = value.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const [y, m, d] = istKey.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 330 * 60 * 1000);
    }

    const [y, m, d] = value.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 330 * 60 * 1000);
  };

  const startDate = parseIstDate(body.startDate);
  const endDate = body.endDate ? parseIstDate(body.endDate) : undefined;

  const nextDue = calculateNextDueDate({
    ...body,
    startDate,
    endDate,
  } as IRecurringRule, startDate);

  const rule = await RecurringRule.create({
    ...body,
    startDate,
    ...(endDate ? { endDate } : {}),
    userId,
    nextDue,
  });

  createAuditLog({
    userId,
    action: 'CREATE',
    resource: 'recurring',
    resourceId: rule._id.toString(),
    after: rule.toObject() as unknown as Record<string, unknown>,
    req,
  });

  return res.status(201).json({
    data: rule,
    error: null,
    message: 'Recurring rule created',
  });
}

export async function updateRecurringRule(req: Request, res: Response) {
  await connectDB();

  const body = req.body as RecurringRuleUpdateInput;
  const userId = req.user!.userId;

  const existing = await RecurringRule.findOne({ _id: req.params.id, userId });

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

  // Recalculate nextDue if frequency-related fields changed
  if (body.frequency || body.dayOfMonth !== undefined || body.dayOfWeek !== undefined) {
    const updated = { ...existing.toObject(), ...body } as unknown as IRecurringRule;
    (body as Record<string, unknown>).nextDue = calculateNextDueDate(updated, existing.startDate);
  }

  const updated = await RecurringRule.findOneAndUpdate(
    { _id: req.params.id, userId },
    body,
    { new: true, runValidators: true },
  ).lean();

  createAuditLog({
    userId,
    action: 'UPDATE',
    resource: 'recurring',
    resourceId: req.params.id,
    before,
    after: updated ? (updated as unknown as Record<string, unknown>) : undefined,
    req,
  });

  return res.status(200).json({
    data: updated,
    error: null,
  });
}

export async function deleteRecurringRule(req: Request, res: Response) {
  await connectDB();

  const userId = req.user!.userId;

  const deleted = await RecurringRule.findOneAndDelete({ _id: req.params.id, userId }).lean();

  if (!deleted) {
    return res.status(404).json({
      data: null,
      error: 'Recurring rule not found',
      errorCode: 'RECURRING_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  createAuditLog({
    userId,
    action: 'DELETE',
    resource: 'recurring',
    resourceId: deleted._id.toString(),
    before: deleted as Record<string, unknown>,
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

  const parseIstDate = (value: string | Date) => {
    if (value instanceof Date) {
      const istKey = value.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const [y, m, d] = istKey.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 330 * 60 * 1000);
    }

    const [y, m, d] = value.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 330 * 60 * 1000);
  };

  const occurrences: Date[] = [];
  const startDate = parseIstDate(body.startDate);
  const endDate = body.endDate ? parseIstDate(body.endDate) : undefined;

  // First occurrence is the start date itself
  if (!endDate || startDate <= endDate) {
    occurrences.push(startDate);
  }

  // Calculate subsequent occurrences
  let current = startDate;
  while (occurrences.length < count) {
    const next = calculateNextDueDate(
      { ...body, startDate, ...(endDate ? { endDate } : {}), nextDue: current } as IRecurringRule,
      current,
    );

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

  const result = await materializeRecurringTransactions(dryRun, userId);

  return res.status(200).json({
    data: result,
    error: null,
    message: dryRun ? 'Preview completed' : `${result.created} transactions created`,
  });
}
