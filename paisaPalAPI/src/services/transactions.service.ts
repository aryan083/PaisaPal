import { parse } from 'csv-parse/sync';

import Transaction from '../models/Transaction';
import { TransactionSchema } from '../schemas';

type ImportError = {
  row: number;
  error: string;
};

export type ImportCsvResult = {
  inserted: number;
  failed: number;
  errors: ImportError[];
};

type RawRecord = Record<string, unknown>;

type NormalizedRecord = {
  date: unknown;
  particulars: unknown;
  amount: unknown;
  category: unknown;
  mode: unknown;
  notes: unknown;
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function normalizeRecord(record: RawRecord): NormalizedRecord {
  const entries = Object.entries(record).map(([key, value]) => [
    normalizeHeader(key),
    value,
  ]);

  const map = Object.fromEntries(entries) as Record<string, unknown>;

  return {
    date: map.date,
    particulars: map.particulars ?? map.description,
    amount: map.amount,
    category: map.category,
    mode: map.mode,
    notes: map.notes ?? map.note ?? '',
  };
}

function parseCsv(csvBuffer: Buffer): RawRecord[] {
  return parse(csvBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as RawRecord[];
}

function validateRow(rowNumber: number, record: RawRecord) {
  const normalized = normalizeRecord(record);
  const parsed = TransactionSchema.safeParse({
    ...normalized,
    amount:
      typeof normalized.amount === 'string'
        ? Number(normalized.amount)
        : normalized.amount,
  });

  if (parsed.success) {
    return { ok: true as const, data: parsed.data };
  }

  return {
    ok: false as const,
    error: {
      row: rowNumber,
      error: parsed.error.issues[0]?.message ?? 'Invalid row',
    },
  };
}

async function insertTransactions(transactions: unknown[]) {
  if (transactions.length === 0) {
    return;
  }

  await Transaction.insertMany(transactions, { ordered: false });
}

export async function importTransactionsFromCsv(
  csvBuffer: Buffer,
): Promise<ImportCsvResult> {
  const records = parseCsv(csvBuffer);
  const errors: ImportError[] = [];
  const valid: unknown[] = [];

  for (let i = 0; i < records.length; i += 1) {
    const rowNumber = i + 2;
    const result = validateRow(rowNumber, records[i] ?? {});
    if (!result.ok) {
      errors.push(result.error);
      continue;
    }
    valid.push(result.data);
  }

  await insertTransactions(valid);

  return { inserted: valid.length, failed: errors.length, errors };
}
