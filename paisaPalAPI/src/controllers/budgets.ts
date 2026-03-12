import type { Request, Response } from 'express';
import { connectDB } from '../lib/mongodb';
import Budget from '../models/Budget';
import Transaction from '../models/Transaction';
import type { BudgetInput, BudgetUpdateInput, Category } from '../schemas';

export async function listBudgets(req: Request, res: Response) {
  await connectDB();

  const month = req.query.month as string | undefined;

  const filter: Record<string, unknown> = {};
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

  const budget = await Budget.findById(req.params.id).lean();

  if (!budget) {
    return res.status(404).json({
      data: null,
      error: 'Budget not found',
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

  // Check if budget already exists for this category + month
  const existing = await Budget.findOne({
    category: body.category,
    month: body.month,
  });

  if (existing) {
    return res.status(409).json({
      data: null,
      error: 'Budget already exists for this category and month',
    });
  }

  const budget = await Budget.create(body);

  return res.status(201).json({
    data: budget,
    error: null,
    message: 'Budget created',
  });
}

export async function updateBudget(req: Request, res: Response) {
  await connectDB();

  const body = req.body as BudgetUpdateInput;

  const updated = await Budget.findByIdAndUpdate(
    req.params.id,
    body,
    { new: true, runValidators: true },
  ).lean();

  if (!updated) {
    return res.status(404).json({
      data: null,
      error: 'Budget not found',
    });
  }

  return res.status(200).json({
    data: updated,
    error: null,
  });
}

export async function deleteBudget(req: Request, res: Response) {
  await connectDB();

  const deleted = await Budget.findByIdAndDelete(req.params.id).lean();

  if (!deleted) {
    return res.status(404).json({
      data: null,
      error: 'Budget not found',
    });
  }

  return res.status(200).json({
    data: null,
    error: null,
    message: 'Budget deleted',
  });
}

export async function getBudgetStats(req: Request, res: Response) {
  await connectDB();

  const month = req.query.month as string;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({
      data: null,
      error: 'Month parameter is required in YYYY-MM format',
    });
  }

  const [year, monthNum] = month.split('-').map(Number);

  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

  const budgets = await Budget.find({ month }).lean();

  const spending = await Transaction.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
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

  const budgetStats = budgets.map((budget) => ({
    category: budget.category,
    monthlyLimit: budget.monthlyLimit,
    spent: spendingByCategory[budget.category] || 0,
    remaining: budget.monthlyLimit - (spendingByCategory[budget.category] || 0),
    percentage: Math.round(((spendingByCategory[budget.category] || 0) / budget.monthlyLimit) * 100),
    isOverBudget: (spendingByCategory[budget.category] || 0) > budget.monthlyLimit,
  }));

  // Add categories that have spending but no budget
  const budgetedCategories = new Set(budgets.map((b) => b.category));
  for (const [category, spent] of Object.entries(spendingByCategory)) {
    if (!budgetedCategories.has(category as Category)) {
      budgetStats.push({
        category: category as Category,
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
