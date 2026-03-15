import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb';
import Envelope from '../models/Envelope';
import Transaction from '../models/Transaction';
import Settings from '../models/Settings';
import SavingsGoal from '../models/SavingsGoal';
import SavingsContribution from '../models/SavingsContribution';
import type { EnvelopeCreateInput, EnvelopeSurplusInput, EnvelopeUpdateInput } from '../schemas';
import { createAuditLog } from '../lib/audit';

function toIstDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function getStatus(spent: number, limit: number, threshold: number): 'under' | 'warning' | 'over' {
  if (limit <= 0) return 'under';
  const pct = (spent / limit) * 100;
  if (pct > 100) return 'over';
  if (pct >= threshold) return 'warning';
  return 'under';
}

async function syncSpent(userId: mongoose.Types.ObjectId, month: string, threshold: number) {
  const startKey = `${month}-01`;
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0, 0, 0, 0));
  const endKey = toIstDateKey(end);

  const agg = await Transaction.aggregate<{ _id: string; total: number }>([
    {
      $match: {
        userId,
        dateKey: { $gte: startKey, $lte: endKey },
      },
    },
    { $group: { _id: '$category', total: { $sum: '$amount' } } },
  ]);

  const map = new Map(agg.map((a) => [a._id, a.total]));

  const env = await Envelope.findOne({ userId, month });
  if (!env) return null;

  env.envelopes = env.envelopes.map((e) => {
    const spent = map.get(e.category) ?? 0;
    return {
      _id: e._id,
      ...e,
      spent,
      status: getStatus(spent, e.limit, threshold),
    };
  });

  await env.save();
  return env;
}

async function copyFromPrevious(userId: mongoose.Types.ObjectId, month: string) {
  const [y, m] = month.split('-').map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const prevDoc = await Envelope.findOne({ userId, month: prev }).lean();
  if (!prevDoc) return null;

  return Envelope.create({
    userId,
    month,
    envelopes: prevDoc.envelopes.map((e) => ({
      category: e.category,
      limit: e.limit,
      spent: 0,
      status: 'under',
    })),
    surplusAmount: 0,
    surplusAction: 'pending',
  });
}

export async function getEnvelope(req: Request, res: Response) {
  await connectDB();
  const month = req.params.month;
  const userId = new mongoose.Types.ObjectId(req.user!.userId);

  const settings = await Settings.findOne({ userId }).lean();
  const threshold = settings?.envelopeWarningThreshold ?? 80;

  let env = await Envelope.findOne({ userId, month });
  if (!env) {
    env = (await copyFromPrevious(userId, month)) ??
      (await Envelope.create({ userId, month, envelopes: [], surplusAmount: 0, surplusAction: 'pending' }));
  }

  const synced = await syncSpent(userId, month, threshold);

  return res.status(200).json({ data: synced ?? env, error: null });
}

export async function createEnvelope(req: Request, res: Response) {
  await connectDB();
  const body = req.body as EnvelopeCreateInput;
  const userId = new mongoose.Types.ObjectId(req.user!.userId);

  const created = await Envelope.create({
    userId,
    month: body.month,
    envelopes: body.envelopes.map((e) => ({
      category: e.category,
      limit: e.limit,
      spent: 0,
      status: 'under',
    })),
    surplusAmount: 0,
    surplusAction: 'pending',
  });

  createAuditLog({
    userId: userId.toString(),
    action: 'CREATE',
    resource: 'envelope',
    resourceId: created._id.toString(),
    after: created.toObject() as unknown as Record<string, unknown>,
    req,
  });

  return res.status(201).json({ data: created, error: null });
}

export async function updateEnvelope(req: Request, res: Response) {
  await connectDB();
  const month = req.params.month;
  const body = req.body as EnvelopeUpdateInput;
  const userId = new mongoose.Types.ObjectId(req.user!.userId);

  const settings = await Settings.findOne({ userId }).lean();
  const threshold = settings?.envelopeWarningThreshold ?? 80;

  const existing = await Envelope.findOne({ userId, month });
  if (!existing) {
    return res.status(404).json({
      data: null,
      error: 'Envelope not found',
      errorCode: 'ENVELOPE_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  const before = existing.toObject() as unknown as Record<string, unknown>;

  existing.envelopes = body.envelopes.map((e) => {
    const prev = existing!.envelopes.find((x) => x.category === e.category);
    const spent = prev?.spent ?? 0;
    return {
      _id: prev?._id,
      category: e.category,
      limit: e.limit,
      spent,
      status: getStatus(spent, e.limit, threshold),
    };
  });

  await existing.save();

  createAuditLog({
    userId: userId.toString(),
    action: 'UPDATE',
    resource: 'envelope',
    resourceId: existing._id.toString(),
    before,
    after: existing.toObject() as unknown as Record<string, unknown>,
    req,
  });

  return res.status(200).json({ data: existing, error: null });
}

export async function handleEnvelopeSurplus(req: Request, res: Response) {
  await connectDB();
  const month = req.params.month;
  const body = req.body as EnvelopeSurplusInput;
  const userId = new mongoose.Types.ObjectId(req.user!.userId);

  const env = await Envelope.findOne({ userId, month });
  if (!env) {
    return res.status(404).json({
      data: null,
      error: 'Envelope not found',
      errorCode: 'ENVELOPE_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  const totalLimit = env.envelopes.reduce((s, e) => s + e.limit, 0);
  const totalSpent = env.envelopes.reduce((s, e) => s + e.spent, 0);
  const surplus = Math.max(0, totalLimit - totalSpent);

  env.surplusAmount = surplus;
  env.surplusAction = body.action;

  const settings = await Settings.findOne({ userId });

  if (body.action === 'carry') {
    if (settings) {
      settings.extra += surplus;
      await settings.save();
    }
    await env.save();
    return res.status(200).json({ data: env, error: null });
  }

  if (!body.goalId) {
    return res.status(400).json({
      data: null,
      error: 'goalId is required for this action',
      errorCode: 'GOAL_REQUIRED',
      suggestion: 'Select a savings goal and try again.',
      requestId: req.requestId,
    });
  }

  const goal = await SavingsGoal.findOne({ _id: body.goalId, userId, status: { $ne: 'ended' } });
  if (!goal) {
    return res.status(404).json({
      data: null,
      error: 'Savings goal not found',
      errorCode: 'SAVINGS_GOAL_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  const toGoal = body.action === 'save' ? surplus : Math.floor(surplus / 2);
  const carry = body.action === 'split' ? surplus - toGoal : 0;

  goal.savedAmount += toGoal;
  if (goal.savedAmount >= goal.targetAmount) goal.status = 'completed';

  env.savingsGoalId = goal._id;
  await env.save();

  await Promise.all([
    goal.save(),
    SavingsContribution.create({ userId, goalId: goal._id, amount: toGoal, type: 'surplus' }),
  ]);

  if (carry > 0 && settings) {
    settings.extra += carry;
    await settings.save();
  }

  return res.status(200).json({ data: { envelope: env, goal }, error: null });
}
