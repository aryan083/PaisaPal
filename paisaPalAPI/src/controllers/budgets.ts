import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb';
import Envelope from '../models/Envelope';
import Transaction from '../models/Transaction';
import type { BudgetInput, BudgetUpdateInput, Category } from '../schemas';
import { createAuditLog } from '../lib/audit';

async function upsertEnvelopeLimit(input: {
  userId: mongoose.Types.ObjectId;
  month: string;
  category: string;
  monthlyLimit: number;
}): Promise<void> {
  let env = await Envelope.findOne({ userId: input.userId, month: input.month });
  if (!env) {
    env = await Envelope.create({
      userId: input.userId,
      month: input.month,
      envelopes: [],
      surplusAmount: 0,
      surplusAction: 'pending',
    });
  }

  const item = env.envelopes.find((e) => e.category === input.category);
  if (item) {
    item.limit = input.monthlyLimit;
  } else {
    env.envelopes.push({
      category: input.category,
      limit: input.monthlyLimit,
      spent: 0,
      status: 'under',
    });
  }

  await env.save();
}

async function deleteEnvelopeLimit(input: {
  userId: mongoose.Types.ObjectId;
  month: string;
  category: string;
}): Promise<void> {
  const env = await Envelope.findOne({ userId: input.userId, month: input.month });
  if (!env) return;
  env.envelopes = env.envelopes.filter((e) => e.category !== input.category);
  await env.save();
}

type BudgetAlias = {
  _id: string;
  userId: string;
  category: Category;
  monthlyLimit: number;
  month: string;
  createdAt: Date;
  updatedAt: Date;
};

function toBudgetAlias(env: {
  userId: mongoose.Types.ObjectId;
  month: string;
  createdAt: Date;
  updatedAt: Date;
}, item: { _id?: mongoose.Types.ObjectId; category: string; limit: number }): BudgetAlias {
  return {
    _id: item._id?.toString() ?? '',
    userId: env.userId.toString(),
    category: item.category as Category,
    monthlyLimit: item.limit,
    month: env.month,
    createdAt: env.createdAt,
    updatedAt: env.updatedAt,
  };
}

async function findEnvelopeItemById(userId: mongoose.Types.ObjectId, itemId: string) {
  const env = await Envelope.findOne({ userId, 'envelopes._id': itemId });
  if (!env) return null;
  const item = env.envelopes.find((e) => e._id?.toString() === itemId);
  if (!item) return null;
  return { env, item };
}

export async function listBudgets(req: Request, res: Response) {
  await connectDB();

  const userId = new mongoose.Types.ObjectId(req.user!.userId);
  const month = req.query.month as string | undefined;

  const filter: Record<string, unknown> = { userId };
  if (month) filter.month = month;

  const envs = await Envelope.find(filter).sort({ month: -1 }).lean();
  const budgets: BudgetAlias[] = [];
  for (const env of envs) {
    for (const item of env.envelopes) {
      budgets.push(toBudgetAlias(env, item));
    }
  }

  budgets.sort((a, b) => a.category.localeCompare(b.category));

  return res.status(200).json({
    data: budgets,
    error: null,
  });
}

export async function getBudget(req: Request, res: Response) {
  await connectDB();

  const userId = new mongoose.Types.ObjectId(req.user!.userId);
  const found = await findEnvelopeItemById(userId, req.params.id);

  if (!found) {
    return res.status(404).json({
      data: null,
      error: 'Budget not found',
      errorCode: 'BUDGET_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  return res.status(200).json({
    data: toBudgetAlias(found.env, found.item),
    error: null,
  });
}

export async function createBudget(req: Request, res: Response) {
  await connectDB();

  const body = req.body as BudgetInput;
  const userId = new mongoose.Types.ObjectId(req.user!.userId);

  let env = await Envelope.findOne({ userId, month: body.month });
  if (!env) {
    env = await Envelope.create({
      userId,
      month: body.month,
      envelopes: [],
      surplusAmount: 0,
      surplusAction: 'pending',
    });
  }

  const existing = env.envelopes.find((e) => e.category === body.category);
  if (existing) {
    return res.status(409).json({
      data: null,
      error: 'Budget already exists for this category and month',
      errorCode: 'BUDGET_EXISTS',
      suggestion: 'Edit the existing budget instead, or change category/month.',
      requestId: req.requestId,
    });
  }

  env.envelopes.push({
    category: body.category,
    limit: body.monthlyLimit,
    spent: 0,
    status: 'under',
  });
  await env.save();

  const createdItem = env.envelopes.find((e) => e.category === body.category);
  if (!createdItem) {
    return res.status(500).json({
      data: null,
      error: 'Failed to create budget',
      errorCode: 'BUDGET_CREATE_FAILED',
      suggestion: 'Please try again.',
      requestId: req.requestId,
    });
  }

  createAuditLog({
    userId: userId.toString(),
    action: 'CREATE',
    resource: 'budget',
    resourceId: createdItem._id?.toString() ?? '',
    after: toBudgetAlias(env, createdItem) as unknown as Record<string, unknown>,
    req,
  });

  return res.status(201).json({
    data: toBudgetAlias(env, createdItem),
    error: null,
    message: 'Budget created',
  });
}

export async function updateBudget(req: Request, res: Response) {
  await connectDB();

  const body = req.body as BudgetUpdateInput;
  const userId = new mongoose.Types.ObjectId(req.user!.userId);
  const found = await findEnvelopeItemById(userId, req.params.id);
  if (!found) {
    return res.status(404).json({
      data: null,
      error: 'Budget not found',
      errorCode: 'BUDGET_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  const before = toBudgetAlias(found.env, found.item);
  if (body.monthlyLimit !== undefined) {
    found.item.limit = body.monthlyLimit;
  }
  await found.env.save();

  const updated = toBudgetAlias(found.env, found.item);

  createAuditLog({
    userId: userId.toString(),
    action: 'UPDATE',
    resource: 'budget',
    resourceId: updated._id,
    before: before ?? undefined,
    after: updated as unknown as Record<string, unknown>,
    req,
  });

  return res.status(200).json({
    data: updated,
    error: null,
  });
}

export async function deleteBudget(req: Request, res: Response) {
  await connectDB();

  const userId = new mongoose.Types.ObjectId(req.user!.userId);
  const found = await findEnvelopeItemById(userId, req.params.id);
  if (!found) {
    return res.status(404).json({
      data: null,
      error: 'Budget not found',
      errorCode: 'BUDGET_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  const before = toBudgetAlias(found.env, found.item);
  found.env.envelopes = found.env.envelopes.filter((e) => e._id?.toString() !== req.params.id);
  await found.env.save();

  createAuditLog({
    userId: userId.toString(),
    action: 'DELETE',
    resource: 'budget',
    resourceId: before._id,
    before: before as unknown as Record<string, unknown>,
    req,
  });

  return res.status(200).json({
    data: null,
    error: null,
    message: 'Budget deleted',
  });
}

export async function getBudgetStats(req: Request, res: Response) {
  await connectDB();

  const userId = new mongoose.Types.ObjectId(req.user!.userId);
  const month = req.query.month as string;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({
      data: null,
      error: 'Month parameter is required in YYYY-MM format',
      errorCode: 'INVALID_MONTH',
      suggestion: 'Please pick a month like 2026-03 and try again.',
      requestId: req.requestId,
    });
  }

  const [year, monthNum] = month.split('-').map(Number);

  const monthStartKey = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const monthEndKey = `${month}-${String(lastDay).padStart(2, '0')}`;

  const env = await Envelope.findOne({ userId, month }).lean();
  const budgets = (env?.envelopes ?? []).map((e) => ({
    category: e.category,
    monthlyLimit: e.limit,
  }));

  const spending = await Transaction.aggregate([
    {
      $match: {
        userId,
        dateKey: { $gte: monthStartKey, $lte: monthEndKey },
      },
    },
    {
      $group: {
        _id: '$category',
        spent: { $sum: '$amount' },
      },
    },
  ]);

  const spendingByCategory: Record<string, number> = {};
  for (const item of spending) {
    spendingByCategory[item._id] = item.spent;
  }

  const budgetStats = budgets.map((budget) => {
    const spent = spendingByCategory[budget.category] || 0;
    return {
      category: budget.category,
      monthlyLimit: budget.monthlyLimit,
      spent,
      remaining: budget.monthlyLimit - spent,
      percentage:
        budget.monthlyLimit > 0
          ? Math.round((spent / budget.monthlyLimit) * 100)
          : -1,
      isOverBudget: spent > budget.monthlyLimit,
    };
  });

  // Add categories that have spending but no budget
  const budgetedCategories = new Set(budgets.map((b) => b.category));
  for (const [category, spent] of Object.entries(spendingByCategory)) {
    if (!budgetedCategories.has(category)) {
      budgetStats.push({
        category,
        monthlyLimit: 0,
        spent,
        remaining: -spent,
        percentage: -1, // Indicates no budget set
        isOverBudget: true,
      });
    }
  }

  return res.status(200).json({
    data: {
      month,
      budgets: budgetStats,
      totalBudgeted: budgets.reduce((sum, b) => sum + b.monthlyLimit, 0),
      totalSpent: Object.values(spendingByCategory).reduce((sum, s) => sum + s, 0),
    },
    error: null,
  });
}
