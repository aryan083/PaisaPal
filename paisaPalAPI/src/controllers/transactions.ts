import type { Request, Response } from 'express';
import { connectDB } from '../lib/mongodb';
import Transaction from '../models/Transaction';
import type { QueryParams, TransactionInput, TransactionUpdateInput } from '../schemas';
import { importTransactionsFromCsv } from '../services/transactions.service';

export async function listTransactions(req: Request, res: Response) {
  await connectDB();

  const query = req.query as unknown as QueryParams;

  const filter: Record<string, unknown> = {};
  if (query.search) {
    filter.$or = [
      { particulars: { $regex: query.search, $options: 'i' } },
      { notes: { $regex: query.search, $options: 'i' } },
    ];
  }

  if (query.category) {
    filter.category = query.category;
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
  const created = await Transaction.create(body);

  return res.status(201).json({
    data: created,
    error: null,
    message: 'Created',
  });
}

export async function getTransaction(req: Request, res: Response) {
  await connectDB();

  const transaction = await Transaction.findById(req.params.id).lean();

  if (!transaction) {
    return res.status(404).json({
      data: null,
      error: 'Transaction not found',
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

  const updated = await Transaction.findByIdAndUpdate(req.params.id, body, {
    new: true,
    runValidators: true,
  }).lean();

  if (!updated) {
    return res.status(404).json({
      data: null,
      error: 'Transaction not found',
    });
  }

  return res.status(200).json({
    data: updated,
    error: null,
  });
}

export async function deleteTransaction(req: Request, res: Response) {
  await connectDB();

  const deleted = await Transaction.findByIdAndDelete(req.params.id).lean();

  if (!deleted) {
    return res.status(404).json({
      data: null,
      error: 'Transaction not found',
    });
  }

  return res.status(200).json({
    data: null,
    error: null,
    message: 'Transaction deleted',
  });
}

export async function importTransactionsCsv(req: Request, res: Response) {
  await connectDB();

  const file = (req as Request & { file?: { buffer: Buffer } }).file;
  if (!file) {
    return res.status(400).json({
      data: null,
      error: 'CSV file is required',
    });
  }

  const result = await importTransactionsFromCsv(file.buffer);

  return res.status(200).json({
    data: result,
    error: null,
  });
}
