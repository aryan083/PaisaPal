import type { Request, Response } from 'express';
import { connectDB } from '../lib/mongodb';
import Transaction from '../models/Transaction';
import Budget from '../models/Budget';
import RecurringRule from '../models/RecurringRule';
import type {
  QueryParams,
  BulkDeleteTransactionsInput,
  RemapCategoryInput,
  TransactionInput,
  TransactionUpdateInput,
} from '../schemas';
import { importTransactionsFromCsv } from '../services/transactions.service';
import { createAuditLog } from '../lib/audit';

function toIstDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export async function listTransactions(req: Request, res: Response) {
  await connectDB();

  const query = req.query as unknown as QueryParams;
  const userId = req.user!.userId;

  await Transaction.updateMany(
    { userId, dateKey: { $exists: false } },
    [
      {
        $set: {
          dateKey: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$date',
              timezone: 'Asia/Kolkata',
            },
          },
        },
      },
    ],
  );

  const filter: Record<string, unknown> = { userId };
  if (query.search) {
    filter.$or = [
      { particulars: { $regex: query.search, $options: 'i' } },
      { notes: { $regex: query.search, $options: 'i' } },
    ];
  }

  if (query.category) {
    filter.category = query.category;
  }

  if (query.mode) {
    filter.mode = query.mode;
  }

  if (query.startDate || query.endDate) {
    filter.dateKey = {};
    if (query.startDate) {
      (filter.dateKey as Record<string, string>).$gte = toIstDateKey(query.startDate);
    }
    if (query.endDate) {
      (filter.dateKey as Record<string, string>).$lte = toIstDateKey(query.endDate);
    }
  }

  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    filter.amount = {};
    if (query.minAmount !== undefined) {
      (filter.amount as Record<string, number>).$gte = query.minAmount;
    }
    if (query.maxAmount !== undefined) {
      (filter.amount as Record<string, number>).$lte = query.maxAmount;
    }
  }

  if (query.hasNotes === true) {
    filter.notes = { $ne: '', $exists: true };
  } else if (query.hasNotes === false) {
    filter.$or = [{ notes: '' }, { notes: { $exists: false } }];
  }

  const sortDirection = query.order === 'asc' ? 1 : -1;
  const skip = (query.page - 1) * query.limit;

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ [query.sort]: sortDirection })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Transaction.countDocuments(filter),
  ]);

  const pages = Math.max(1, Math.ceil(total / query.limit));

  return res.status(200).json({
    data: {
      transactions,
      total,
      page: query.page,
      pages,
    },
    error: null,
  });
}

export async function createTransaction(req: Request, res: Response) {
  await connectDB();

  const body = req.body as TransactionInput;
  const userId = req.user!.userId;

  const created = await Transaction.create({
    ...body,
    dateKey: toIstDateKey(body.date),
    userId,
  });

  createAuditLog({
    userId,
    action: 'CREATE',
    resource: 'transaction',
    resourceId: created._id.toString(),
    after: created.toObject() as unknown as Record<string, unknown>,
    req,
  });

  return res.status(201).json({
    data: created,
    error: null,
    message: 'Created',
  });
}

export async function getTransaction(req: Request, res: Response) {
  await connectDB();

  const userId = req.user!.userId;
  const transaction = await Transaction.findOne({ _id: req.params.id, userId }).lean();

  if (!transaction) {
    return res.status(404).json({
      data: null,
      error: 'Transaction not found',
      errorCode: 'TX_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  return res.status(200).json({
    data: transaction,
    error: null,
  });
}

export async function updateTransaction(req: Request, res: Response) {
  await connectDB();

  const body = req.body as TransactionUpdateInput;
  const userId = req.user!.userId;

  const updatePayload: Record<string, unknown> = { ...body };
  if (body.date instanceof Date) {
    updatePayload.dateKey = toIstDateKey(body.date);
  }

  const before = await Transaction.findOne({ _id: req.params.id, userId }).lean();
  if (!before) {
    return res.status(404).json({
      data: null,
      error: 'Transaction not found',
      errorCode: 'TX_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  const updated = await Transaction.findOneAndUpdate(
    { _id: req.params.id, userId },
    updatePayload,
    { new: true, runValidators: true }
  ).lean();

  if (!updated) {
    return res.status(404).json({
      data: null,
      error: 'Transaction not found',
      errorCode: 'TX_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  createAuditLog({
    userId,
    action: 'UPDATE',
    resource: 'transaction',
    resourceId: updated._id.toString(),
    before,
    after: updated,
    req,
  });

  return res.status(200).json({
    data: updated,
    error: null,
  });
}

export async function deleteTransaction(req: Request, res: Response) {
  await connectDB();

  const userId = req.user!.userId;

  const deleted = await Transaction.findOneAndDelete({ _id: req.params.id, userId }).lean();

  if (!deleted) {
    return res.status(404).json({
      data: null,
      error: 'Transaction not found',
      errorCode: 'TX_NOT_FOUND',
      suggestion: 'Please refresh and try again.',
      requestId: req.requestId,
    });
  }

  createAuditLog({
    userId,
    action: 'DELETE',
    resource: 'transaction',
    resourceId: deleted._id.toString(),
    before: deleted,
    req,
  });

  return res.status(200).json({
    data: null,
    error: null,
    message: 'Transaction deleted',
  });
}

export async function bulkDeleteTransactions(req: Request, res: Response) {
  await connectDB();

  const body = req.body as BulkDeleteTransactionsInput;
  const userId = req.user!.userId;

  const result = await Transaction.deleteMany({
    _id: { $in: body.ids },
    userId,
  });

  createAuditLog({
    userId,
    action: 'DELETE',
    resource: 'transaction',
    resourceId: 'bulk',
    before: { ids: body.ids },
    after: { deletedCount: result.deletedCount },
    req,
  });

  return res.status(200).json({
    data: { deletedCount: result.deletedCount },
    error: null,
    message: `Deleted ${result.deletedCount} transactions`,
  });
}

export async function importTransactionsCsv(req: Request, res: Response) {
  await connectDB();

  const file = (req as Request & { file?: { buffer: Buffer } }).file;
  if (!file) {
    return res.status(400).json({
      data: null,
      error: 'CSV file is required',
      errorCode: 'CSV_FILE_REQUIRED',
      suggestion: 'Please choose a CSV file and try again.',
      requestId: req.requestId,
    });
  }

  const dryRun = req.query.dryRun === 'true';
  const skipDuplicates = req.query.skipDuplicates === 'true';
  const userId = req.user!.userId;

  try {
    const result = await importTransactionsFromCsv(file.buffer, {
      dryRun,
      skipDuplicates,
      userId,
    });

    return res.status(200).json({
      data: result,
      error: null,
      message: dryRun
        ? 'Preview completed - no transactions inserted'
        : `Imported ${result.inserted} transactions`,
    });
  } catch (err) {
    console.error('CSV import error:', err);
    throw err;
  }
}

export async function exportTransactionsCsv(req: Request, res: Response) {
  await connectDB();

  const query = req.query as unknown as QueryParams;
  const userId = req.user!.userId;

  const filter: Record<string, unknown> = { userId };
  if (query.search) {
    filter.$or = [
      { particulars: { $regex: query.search, $options: 'i' } },
      { notes: { $regex: query.search, $options: 'i' } },
    ];
  }

  if (query.category) {
    filter.category = query.category;
  }

  if (query.mode) {
    filter.mode = query.mode;
  }

  if (query.startDate || query.endDate) {
    filter.date = {};
    if (query.startDate) {
      (filter.date as Record<string, Date>).$gte = query.startDate;
    }
    if (query.endDate) {
      (filter.date as Record<string, Date>).$lte = query.endDate;
    }
  }

  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    filter.amount = {};
    if (query.minAmount !== undefined) {
      (filter.amount as Record<string, number>).$gte = query.minAmount;
    }
    if (query.maxAmount !== undefined) {
      (filter.amount as Record<string, number>).$lte = query.maxAmount;
    }
  }

  if (query.hasNotes === true) {
    filter.notes = { $ne: '', $exists: true };
  } else if (query.hasNotes === false) {
    filter.$or = [{ notes: '' }, { notes: { $exists: false } }];
  }

  const sortDirection = query.order === 'asc' ? 1 : -1;

  const transactions = await Transaction.find(filter)
    .sort({ [query.sort]: sortDirection })
    .limit(10000)
    .lean();

  // Generate CSV
  const header = 'date,particulars,amount,category,mode,notes\n';
  const rows = transactions
    .map((tx) => {
      const date = tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : '';
      const particulars = `"${(tx.particulars ?? '').replace(/"/g, '""')}"`;
      const amount = tx.amount ?? 0;
      const category = tx.category ?? '';
      const mode = tx.mode ?? '';
      const notes = `"${(tx.notes ?? '').replace(/"/g, '""')}"`;
      return `${date},${particulars},${amount},${category},${mode},${notes}`;
    })
    .join('\n');

  const csv = header + rows;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="transactions-${new Date().toISOString().split('T')[0]}.csv"`);

  return res.status(200).send(csv);
}

export async function remapCategory(req: Request, res: Response) {
  await connectDB();

  const body = req.body as RemapCategoryInput;
  const userId = req.user!.userId;

  const [txRes, budgetRes, recurringRes] = await Promise.all([
    Transaction.updateMany(
      { userId, category: body.fromCategory },
      { $set: { category: body.toCategory } },
    ),
    Budget.updateMany(
      { userId, category: body.fromCategory },
      { $set: { category: body.toCategory } },
    ),
    RecurringRule.updateMany(
      { userId, category: body.fromCategory },
      { $set: { category: body.toCategory } },
    ),
  ]);

  createAuditLog({
    userId,
    action: 'UPDATE',
    resource: 'category',
    resourceId: userId,
    after: {
      fromCategory: body.fromCategory,
      toCategory: body.toCategory,
      transactionsModified: txRes.modifiedCount,
      budgetsModified: budgetRes.modifiedCount,
      recurringRulesModified: recurringRes.modifiedCount,
    },
    req,
  });

  return res.status(200).json({
    data: {
      transactionsModified: txRes.modifiedCount,
      budgetsModified: budgetRes.modifiedCount,
      recurringRulesModified: recurringRes.modifiedCount,
    },
    error: null,
  });
}
