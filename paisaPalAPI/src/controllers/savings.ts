import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb';
import SavingsGoal from '../models/SavingsGoal';
import SavingsContribution from '../models/SavingsContribution';
import type {
  SavingsContributionCreateInput,
  SavingsGoalCreateInput,
  SavingsGoalUpdateInput,
} from '../schemas';
import { createAuditLog } from '../lib/audit';

function monthsLeft(deadline?: Date): number {
  if (!deadline) return 0;
  const now = new Date();
  const y = deadline.getUTCFullYear() - now.getUTCFullYear();
  const m = deadline.getUTCMonth() - now.getUTCMonth();
  return Math.max(0, y * 12 + m + (deadline.getUTCDate() >= now.getUTCDate() ? 0 : -1));
}

function computeMonthlyTarget(target: number, saved: number, deadline?: Date): number {
  const left = Math.max(0, target - saved);
  const m = monthsLeft(deadline);
  if (m <= 0) return left;
  return Math.ceil(left / m);
}

function etaString(deadline?: Date): string {
  const m = monthsLeft(deadline);
  if (!deadline) return '';
  if (m <= 0) return '0 months';
  if (m < 12) return `${m} months`;
  const y = Math.floor(m / 12);
  const rem = m % 12;
  return rem === 0 ? `${y} years` : `${y} years ${rem} months`;
}

export async function listSavingsGoals(req: Request, res: Response) {
  await connectDB();
  const userId = req.user!.userId;

  const goals = await SavingsGoal.find({ userId, status: { $ne: 'ended' } })
    .sort({ status: 1, deadline: 1, createdAt: -1 })
    .lean();

  const enriched = goals.map((g) => {
    const progressPercent = g.targetAmount <= 0
      ? 0
      : Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100));
    const m = monthsLeft(g.deadline);
    const monthlyNeeded = computeMonthlyTarget(g.targetAmount, g.savedAmount, g.deadline);
    return {
      ...g,
      progressPercent,
      monthsLeft: m,
      monthlyNeeded,
      eta: etaString(g.deadline),
    };
  });

  return res.status(200).json({ data: enriched, error: null });
}

export async function createSavingsGoal(req: Request, res: Response) {
  await connectDB();
  const body = req.body as SavingsGoalCreateInput;
  const userId = req.user!.userId;

  const monthlyTarget = computeMonthlyTarget(body.targetAmount, 0, body.deadline);

  const created = await SavingsGoal.create({
    userId,
    name: body.name,
    emoji: body.emoji ?? '🎯',
    targetAmount: body.targetAmount,
    savedAmount: 0,
    monthlyTarget,
    deadline: body.deadline,
    status: 'active',
    color: body.color ?? '#22d47a',
  });

  createAuditLog({
    userId,
    action: 'CREATE',
    resource: 'savings_goal',
    resourceId: created._id.toString(),
    after: created.toObject() as unknown as Record<string, unknown>,
    req,
  });

  return res.status(201).json({ data: created, error: null });
}

export async function updateSavingsGoal(req: Request, res: Response) {
  await connectDB();
  const body = req.body as SavingsGoalUpdateInput;
  const userId = req.user!.userId;

  const existing = await SavingsGoal.findOne({ _id: req.params.id, userId, status: { $ne: 'ended' } });
  if (!existing) {
    return res.status(404).json({
      data: null,
      error: 'Savings goal not found',
      errorCode: 'SAVINGS_GOAL_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  const before = existing.toObject() as unknown as Record<string, unknown>;

  if (body.name !== undefined) existing.name = body.name;
  if (body.emoji !== undefined) existing.emoji = body.emoji;
  if (body.targetAmount !== undefined) existing.targetAmount = body.targetAmount;
  if (body.deadline !== undefined) existing.deadline = body.deadline;
  if (body.color !== undefined) existing.color = body.color;

  existing.monthlyTarget = computeMonthlyTarget(existing.targetAmount, existing.savedAmount, existing.deadline);

  await existing.save();

  createAuditLog({
    userId,
    action: 'UPDATE',
    resource: 'savings_goal',
    resourceId: existing._id.toString(),
    before,
    after: existing.toObject() as unknown as Record<string, unknown>,
    req,
  });

  return res.status(200).json({ data: existing, error: null });
}

export async function deleteSavingsGoal(req: Request, res: Response) {
  await connectDB();
  const userId = req.user!.userId;

  const goal = await SavingsGoal.findOne({ _id: req.params.id, userId, status: { $ne: 'ended' } });
  if (!goal) {
    return res.status(404).json({
      data: null,
      error: 'Savings goal not found',
      errorCode: 'SAVINGS_GOAL_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  const before = goal.toObject() as unknown as Record<string, unknown>;

  // Delete all contributions for this goal
  await SavingsContribution.deleteMany({ goalId: goal._id, userId });

  // Actually delete the goal from database (hard delete)
  await SavingsGoal.deleteOne({ _id: req.params.id, userId });

  createAuditLog({
    userId,
    action: 'DELETE',
    resource: 'savings_goal',
    resourceId: goal._id.toString(),
    before,
    req,
  });

  return res.status(200).json({ data: null, error: null });
}

export async function contributeToSavingsGoal(req: Request, res: Response) {
  await connectDB();
  const body = req.body as SavingsContributionCreateInput;
  const userId = req.user!.userId;
  const userObjId = new mongoose.Types.ObjectId(userId);

  const goal = await SavingsGoal.findOne({
    _id: req.params.id,
    userId: userObjId,
    status: { $in: ['active', 'paused', 'completed'] },
  });

  if (!goal) {
    return res.status(404).json({
      data: null,
      error: 'Savings goal not found',
      errorCode: 'SAVINGS_GOAL_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  goal.savedAmount += body.amount;
  goal.monthlyTarget = computeMonthlyTarget(goal.targetAmount, goal.savedAmount, goal.deadline);
  if (goal.savedAmount >= goal.targetAmount) {
    goal.status = 'completed';
  }

  const contribution = await SavingsContribution.create({
    userId: userObjId,
    goalId: goal._id,
    amount: body.amount,
    type: body.type,
    note: body.note,
  });

  await goal.save();

  createAuditLog({
    userId,
    action: 'CREATE',
    resource: 'savings_contribution',
    resourceId: contribution._id.toString(),
    after: contribution.toObject() as unknown as Record<string, unknown>,
    req,
  });

  return res.status(200).json({ data: { goal, contribution }, error: null });
}

export async function getSavingsGoalHistory(req: Request, res: Response) {
  await connectDB();
  const userId = req.user!.userId;

  const items = await SavingsContribution.find({ userId, goalId: req.params.id })
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({ data: items, error: null });
}
