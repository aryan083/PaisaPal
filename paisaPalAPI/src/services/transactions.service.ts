import { parse } from 'csv-parse/sync';

import Transaction from '../models/Transaction';
import { TransactionSchema } from '../schemas';

type ImportError = {
  row: number;
  error: string;
};

type DuplicateInfo = {
  row: number;
  particulars: string;
  amount: number;
  date: string;
  reason: string;
};

export type ImportCsvResult = {
  inserted: number;
  failed: number;
  duplicates: number;
  errors: ImportError[];
  duplicateDetails?: DuplicateInfo[];
  preview?: Array<{
    row: number;
    data: {
      date: Date;
      particulars: string;
      amount: number;
      category: string;
      mode: string;
      notes: string;
    };
    isDuplicate: boolean;
  }>;
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
    amount: map.amount ?? map['amount paid'] ?? map['amount_paid'],
    category: map.category,
    mode: map.mode ?? map['mode of payment'] ?? map['mode_of_payment'] ?? map['payment mode'] ?? map['payment_mode'],
    notes: map.notes ?? map.note ?? '',
  };
}

function parseCsv(csvBuffer: Buffer): RawRecord[] {
  try {
    return parse(csvBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as RawRecord[];
  } catch (err) {
    console.error('CSV parse error:', err);
    throw new Error(`Failed to parse CSV: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

function validateRow(rowNumber: number, record: RawRecord) {
  console.log(`Validating row ${rowNumber}:`, JSON.stringify(record));
  const normalized = normalizeRecord(record);
  console.log(`Normalized row ${rowNumber}:`, JSON.stringify(normalized));
  let parsed:
    | ReturnType<typeof TransactionSchema.safeParse>
    | { success: false; error: { issues: Array<{ message: string }> } };
  try {
    parsed = TransactionSchema.safeParse({
      ...normalized,
      amount:
        typeof normalized.amount === 'string'
          ? Number(normalized.amount)
          : normalized.amount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid row';
    parsed = { success: false, error: { issues: [{ message }] } };
  }

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

async function checkDuplicates(
  transactions: Array<{ date: Date; particulars: string; amount: number }>,
  userId?: string,
): Promise<Set<number>> {
  const duplicateIndices = new Set<number>();

  const checks = transactions.map(async (tx, index) => {
    const filter: Record<string, unknown> = {
      date: {
        $gte: new Date(tx.date.setHours(0, 0, 0, 0)),
        $lt: new Date(tx.date.setHours(23, 59, 59, 999)),
      },
      particulars: tx.particulars,
      amount: tx.amount,
    };
    if (userId) {
      filter.userId = userId;
    }

    const existing = await Transaction.findOne(filter).lean();

    if (existing) {
      duplicateIndices.add(index);
    }
  });

  await Promise.all(checks);
  return duplicateIndices;
}

async function insertTransactions(transactions: unknown[]) {
  if (transactions.length === 0) {
    return;
  }

  await Transaction.insertMany(transactions, { ordered: false });
}

export async function importTransactionsFromCsv(
  csvBuffer: Buffer,
  options: { dryRun?: boolean; skipDuplicates?: boolean; userId?: string } = {},
): Promise<ImportCsvResult> {
  const { dryRun = false, skipDuplicates = false, userId } = options;

  let records: RawRecord[];
  try {
    records = parseCsv(csvBuffer);
  } catch (err) {
    console.error('CSV parse error:', err);
    throw err;
  }

  console.log(`Parsed ${records.length} records from CSV`);
  if (records.length > 0) {
    console.log('First record keys:', Object.keys(records[0]));
    console.log('First record:', JSON.stringify(records[0]));
  }

  const errors: ImportError[] = [];
  const valid: Array<{
    row: number;
    data: {
      date: Date;
      particulars: string;
      amount: number;
      category: string;
      mode: string;
      notes: string;
    };
  }> = [];

  for (let i = 0; i < records.length; i += 1) {
    const rowNumber = i + 2;
    const result = validateRow(rowNumber, records[i] ?? {});
    if (!result.ok) {
      errors.push(result.error);
      continue;
    }
    valid.push({ row: rowNumber, data: result.data });
  }

  const duplicateDetails: DuplicateInfo[] = [];
  let duplicates = 0;

  // Check for duplicates
  const duplicateIndices = await checkDuplicates(valid.map((v) => v.data), userId);

  const preview = valid.map((v, index) => ({
    row: v.row,
    data: v.data,
    isDuplicate: duplicateIndices.has(index),
  }));

  const toInsert = skipDuplicates
    ? valid.filter((_, index) => !duplicateIndices.has(index))
    : valid;

  duplicates = duplicateIndices.size;

  for (const index of duplicateIndices) {
    const v = valid[index];
    if (v) {
      duplicateDetails.push({
        row: v.row,
        particulars: v.data.particulars,
        amount: v.data.amount,
        date: v.data.date.toISOString().split('T')[0] ?? '',
        reason: 'Matching date, particulars, and amount found',
      });
    }
  }

  if (!dryRun && toInsert.length > 0) {
    const insertData = toInsert.map((v) => ({
      ...v.data,
      ...(userId ? { userId } : {}),
    }));
    await insertTransactions(insertData);
  }

  return {
    inserted: dryRun ? 0 : toInsert.length,
    failed: errors.length,
    duplicates,
    errors,
    duplicateDetails,
    preview: dryRun ? preview : undefined,
  };
}
