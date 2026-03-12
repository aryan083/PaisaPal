import type { Request, Response } from 'express';
import { connectDB } from '../lib/mongodb';
import Transaction from '../models/Transaction';

type CategoryAgg = {
  _id: string;
  total: number;
  count: number;
};

type DateAgg = {
  _id: string;
  total: number;
};

type ModeAgg = {
  _id: string;
  total: number;
};

export async function getStats(_req: Request, res: Response) {
  await connectDB();

  const [totalAgg] = await Transaction.aggregate<{ totalSpent: number }>([
    { $group: { _id: null, totalSpent: { $sum: '$amount' } } },
    { $project: { _id: 0, totalSpent: 1 } },
  ]);

  const totalSpent = totalAgg?.totalSpent ?? 0;

  const byCategory = await Transaction.aggregate<CategoryAgg>([
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);

  const byDate = await Transaction.aggregate<DateAgg>([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byModeArr = await Transaction.aggregate<ModeAgg>([
    { $group: { _id: '$mode', total: { $sum: '$amount' } } },
  ]);

  const byMode: Record<'Online' | 'Cash', number> = { Online: 0, Cash: 0 };
  for (const item of byModeArr) {
    const mode = item._id;
    if (mode === 'Online' || mode === 'Cash') {
      byMode[mode] = item.total;
    }
  }

  const transactionCount = await Transaction.countDocuments({});

  const [activeDaysAgg] = await Transaction.aggregate<{ activeDays: number }>([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
      },
    },
    { $count: 'activeDays' },
  ]);

  const activeDays = activeDaysAgg?.activeDays ?? 0;
  const dailyAverage = activeDays === 0 ? 0 : Math.round(totalSpent / activeDays);

  const [biggestDayAgg] = await Transaction.aggregate<{ date: string; total: number }>([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { total: -1 } },
    { $limit: 1 },
    { $project: { _id: 0, date: '$_id', total: 1 } },
  ]);

  const biggestDay = biggestDayAgg ?? null;

  const biggestTransaction = await Transaction.findOne({}).sort({ amount: -1 }).lean();

  const [rapidoAgg] = await Transaction.aggregate<{ total: number; count: number }>([
    { $match: { category: 'Rapido' } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $project: { _id: 0, total: 1, count: 1 } },
  ]);

  const rapidoTotal = rapidoAgg?.total ?? 0;
  const rapidoCount = rapidoAgg?.count ?? 0;
  const rapidoStats = {
    total: rapidoTotal,
    count: rapidoCount,
    avgPerRide: rapidoCount === 0 ? 0 : Math.round(rapidoTotal / rapidoCount),
  };

  return res.status(200).json({
    data: {
      totalSpent,
      byCategory: byCategory.map((c) => ({
        category: c._id,
        total: c.total,
        count: c.count,
      })),
      byDate: byDate.map((d) => ({ date: d._id, total: d.total })),
      byMode,
      transactionCount,
      activeDays,
      dailyAverage,
      biggestDay,
      biggestTransaction,
      rapidoStats,
    },
    error: null,
  });
}
