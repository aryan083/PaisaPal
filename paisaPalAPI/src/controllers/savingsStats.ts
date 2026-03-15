import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb';
import SavingsGoal from '../models/SavingsGoal';
import SavingsContribution from '../models/SavingsContribution';
import Transaction from '../models/Transaction';
import RecurringTransaction from '../models/RecurringTransaction';
import Settings from '../models/Settings';
import { getDaysUntilDue, getProjectedMonthly, type Frequency } from '../lib/recurringUtils';

function toIstDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function getMonthKey(d: Date): string {
  return toIstDateKey(d).slice(0, 7);
}

async function getNoSpendStats(userId: mongoose.Types.ObjectId) {
  const now = new Date();
  const month = getMonthKey(now);
  const startKey = `${month}-01`;
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0, 0, 0, 0));
  const endKey = toIstDateKey(end);

  const daysAgg = await Transaction.aggregate<{ _id: string }>([
    { $match: { userId, dateKey: { $gte: startKey, $lte: endKey } } },
    { $group: { _id: '$dateKey' } },
  ]);

  const active = new Set(daysAgg.map((d) => d._id));
  const daysInMonth = Number(endKey.slice(8, 10));
  const noSpendDays = Math.max(0, daysInMonth - active.size);

  let streak = 0;
  for (let i = 0; i < daysInMonth; i += 1) {
    const key = `${month}-${String(daysInMonth - i).padStart(2, '0')}`;
    if (active.has(key)) break;
    streak += 1;
  }

  return { noSpendDays, streak };
}

export async function getSavingsStats(req: Request, res: Response) {
  await connectDB();
  const userId = new mongoose.Types.ObjectId(req.user!.userId);

  const [goals, recurring, settings, rapidoTaxAgg] = await Promise.all([
    SavingsGoal.find({ userId, status: { $ne: 'ended' } }).lean(),
    RecurringTransaction.find({ userId, status: 'active' }).lean(),
    Settings.findOne({ userId }).lean(),
    SavingsContribution.aggregate<{ total: number }>([
      { $match: { userId, type: 'rapido_tax' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
      { $project: { _id: 0, total: 1 } },
    ]),
  ]);

  const totalSaved = goals.reduce((s, g) => s + (g.savedAmount ?? 0), 0);
  const activeGoals = goals.filter((g) => g.status === 'active').length;
  const completedGoals = goals.filter((g) => g.status === 'completed').length;

  const totalIncome = (settings?.stipend ?? 0) + (settings?.extra ?? 0);
  const savingsRate = totalIncome <= 0 ? 0 : Math.round((totalSaved / totalIncome) * 1000) / 10;

  const monthlyRecurringCost = recurring.reduce((s, r) => {
    return s + getProjectedMonthly(r.amount, r.frequency as Frequency);
  }, 0);

  const upcomingDue = recurring
    .map((r) => ({
      ...r,
      daysUntilDue: getDaysUntilDue(r.nextDueDate),
      projectedMonthly: getProjectedMonthly(r.amount, r.frequency as Frequency),
    }))
    .filter((r) => r.daysUntilDue <= 7)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    .slice(0, 10);

  const { noSpendDays, streak } = await getNoSpendStats(userId);

  return res.status(200).json({
    data: {
      totalSaved,
      activeGoals,
      completedGoals,
      savingsRate,
      monthlyRecurringCost,
      upcomingDue,
      noSpendDays,
      noSpendStreak: streak,
      bestStreak: streak,
      rapidoTaxSaved: rapidoTaxAgg[0]?.total ?? 0,
    },
    error: null,
  });
}
