import type { Frequency } from './recurringUtils';

export interface DetectedRecurring {
  name: string;
  amount: number;
  category: string;
  frequency: Frequency;
  confidence: number;
  occurrences: number;
  avgGapDays: number;
  lastSeen: Date;
  suggestedNextDate: Date;
  matchingTransactionIds: string[];
}

type Tx = {
  _id: unknown;
  particulars: string;
  amount: number;
  category: string;
  date: Date;
};

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

function daysBetween(a: Date, b: Date): number {
  const diff = b.getTime() - a.getTime();
  return Math.round(diff / 86400000);
}

function avg(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0) / Math.max(1, nums.length);
}

function stddev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mu = avg(nums);
  const v = nums.reduce((s, n) => s + (n - mu) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(v);
}

function gapToFrequency(gap: number): Frequency | null {
  if (gap <= 2) return 'daily';
  if (gap <= 9) return 'weekly';
  if (gap <= 18) return 'biweekly';
  if (gap <= 45) return 'monthly';
  if (gap >= 300) return 'yearly';
  return null;
}

function confidenceScore(gaps: number[]): number {
  if (gaps.length < 2) return 0;
  const mu = avg(gaps);
  const sd = stddev(gaps);
  const cv = mu === 0 ? 1 : sd / mu;
  return Math.max(0, Math.min(1, 1 - cv));
}

export function detectRecurring(transactions: Tx[]): DetectedRecurring[] {
  const groups = new Map<string, Tx[]>();
  for (const tx of transactions) {
    const key = `${normalizeName(tx.particulars)}|${tx.amount}`;
    const arr = groups.get(key) ?? [];
    arr.push(tx);
    groups.set(key, arr);
  }

  const suggestions: DetectedRecurring[] = [];
  for (const arr of groups.values()) {
    if (arr.length < 3) continue;
    const sorted = [...arr].sort((a, b) => a.date.getTime() - b.date.getTime());
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      gaps.push(daysBetween(sorted[i - 1]!.date, sorted[i]!.date));
    }
    const mu = avg(gaps);
    const freq = gapToFrequency(mu);
    if (!freq) continue;

    const conf = confidenceScore(gaps);
    if (conf < 0.55) continue;

    const last = sorted[sorted.length - 1]!;
    const suggestedNextDate = new Date(last.date.getTime() + Math.round(mu) * 86400000);

    suggestions.push({
      name: last.particulars,
      amount: last.amount,
      category: last.category,
      frequency: freq,
      confidence: Math.round(conf * 100) / 100,
      occurrences: sorted.length,
      avgGapDays: Math.round(mu),
      lastSeen: last.date,
      suggestedNextDate,
      matchingTransactionIds: sorted.map((t) => String(t._id)),
    });
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}
