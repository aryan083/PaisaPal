import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb';
import Budget from '../models/Budget';
import Transaction from '../models/Transaction';
import type { BudgetInput, BudgetUpdateInput, Category } from '../schemas';
import { createAuditLog } from '../lib/audit';

export async function listBudgets(req: Request, res: Response) {
  await connectDB();

  const userId = req.user!.userId;
  const month = req.query.month as string | undefined;

  const filter: Record<string, unknown> = { userId };
  if (month) {
    filter.month = month;
  }

  const budgets = await Budget.find(filter).sort({ category: 1 }).lean();

  return res.status(200).json({
    data: budgets,
    error: null,
  });
}

export async function getBudget(req: Request, res: Response) {
  await connectDB();

  const userId = req.user!.userId;
  const budget = await Budget.findOne({ _id: req.params.id, userId }).lean();

  if (!budget) {
    return res.status(404).json({
      data: null,
      error: 'Budget not found',
      errorCode: 'BUDGET_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  return res.status(200).json({
    data: budget,
    error: null,
  });
}

export async function createBudget(req: Request, res: Response) {
  await connectDB();

  const body = req.body as BudgetInput;
  const userId = req.user!.userId;

  // Check if budget already exists for this category + month
  const existing = await Budget.findOne({
    userId,
    category: body.category,
    month: body.month,
  });

  if (existing) {
    return res.status(409).json({
      data: null,
      error: 'Budget already exists for this category and month',
      errorCode: 'BUDGET_EXISTS',
      suggestion: 'Edit the existing budget instead, or change category/month.',
      requestId: req.requestId,
    });
  }

  const budget = await Budget.create({ ...body, userId });

  createAuditLog({
    userId,
    action: 'CREATE',
    resource: 'budget',
    resourceId: budget._id.toString(),
    after: budget.toObject() as unknown as Record<string, unknown>,
    req,
  });

  return res.status(201).json({
    data: budget,
    error: null,
    message: 'Budget created',
  });
}

export async function updateBudget(req: Request, res: Response) {
  await connectDB();

  const body = req.body as BudgetUpdateInput;
  const userId = req.user!.userId;

  const before = await Budget.findOne({ _id: req.params.id, userId }).lean();

  const updated = await Budget.findOneAndUpdate(
    { _id: req.params.id, userId },
    body,
    { new: true, runValidators: true },
  ).lean();

  if (!updated) {
    return res.status(404).json({
      data: null,
      error: 'Budget not found',
      errorCode: 'BUDGET_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  createAuditLog({
    userId,
    action: 'UPDATE',
    resource: 'budget',
    resourceId: updated._id.toString(),
    before: before ?? undefined,
    after: updated as Record<string, unknown>,
    req,
  });

  return res.status(200).json({
    data: updated,
    error: null,
  });
}

export async function deleteBudget(req: Request, res: Response) {
  await connectDB();

  const userId = req.user!.userId;

  const deleted = await Budget.findOneAndDelete({ _id: req.params.id, userId }).lean();

  if (!deleted) {
    return res.status(404).json({
      data: null,
      error: 'Budget not found',
      errorCode: 'BUDGET_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  createAuditLog({
    userId,
    action: 'DELETE',
    resource: 'budget',
    resourceId: deleted._id.toString(),
    before: deleted as Record<string, unknown>,
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

  const budgets = await Budget.find({ userId: req.user!.userId, month }).lean();

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
