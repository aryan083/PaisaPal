import type { Request, Response } from 'express';
import { connectDB } from '../lib/mongodb';
import RecurringRule, { type IRecurringRule } from '../models/RecurringRule';
import type { RecurringRuleInput, RecurringRuleUpdateInput } from '../schemas';
import { calculateNextDueDate, materializeRecurringTransactions } from '../services/recurring.service';

export async function listRecurringRules(req: Request, res: Response) {
  await connectDB();

  const rules = await RecurringRule.find()
    .sort({ nextDue: 1 })
    .lean();

  return res.status(200).json({
    data: rules,
    error: null,
  });
}

export async function getRecurringRule(req: Request, res: Response) {
  await connectDB();

  const rule = await RecurringRule.findById(req.params.id).lean();

  if (!rule) {
    return res.status(404).json({
      data: null,
      error: 'Recurring rule not found',
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

  const nextDue = calculateNextDueDate({
    ...body,
    startDate: body.startDate,
  } as IRecurringRule, body.startDate);

  const rule = await RecurringRule.create({
    ...body,
    nextDue,
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

  const existing = await RecurringRule.findById(req.params.id);

  if (!existing) {
    return res.status(404).json({
      data: null,
      error: 'Recurring rule not found',
    });
  }

  // Recalculate nextDue if frequency-related fields changed
  if (body.frequency || body.dayOfMonth !== undefined || body.dayOfWeek !== undefined) {
    const updated = { ...existing.toObject(), ...body } as unknown as IRecurringRule;
    (body as Record<string, unknown>).nextDue = calculateNextDueDate(updated, existing.startDate);
  }

  const updated = await RecurringRule.findByIdAndUpdate(
    req.params.id,
    body,
    { new: true, runValidators: true },
  ).lean();

  return res.status(200).json({
    data: updated,
    error: null,
  });
}

export async function deleteRecurringRule(req: Request, res: Response) {
  await connectDB();

  const deleted = await RecurringRule.findByIdAndDelete(req.params.id).lean();

  if (!deleted) {
    return res.status(404).json({
      data: null,
      error: 'Recurring rule not found',
    });
  }

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

  const occurrences: Date[] = [];
  const endDate = body.endDate ? new Date(body.endDate) : undefined;

  // First occurrence is the start date itself
  if (!endDate || body.startDate <= endDate) {
    occurrences.push(new Date(body.startDate));
  }

  // Calculate subsequent occurrences
  let current = body.startDate;
  while (occurrences.length < count) {
    const next = calculateNextDueDate(
      { ...body, nextDue: current } as IRecurringRule,
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

  const dryRun = req.query.dryRun === 'true';

  const result = await materializeRecurringTransactions(dryRun);

  return res.status(200).json({
    data: result,
    error: null,
    message: dryRun ? 'Preview completed' : `${result.created} transactions created`,
  });
}
