import type { IRecurringRule } from '../models/RecurringRule';
import Transaction from '../models/Transaction';

function toIstDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function istStartOfDayUtc(d: Date): Date {
  const istKey = toIstDateKey(d); // YYYY-MM-DD
  const [y, m, day] = istKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day, 0, 0, 0) - 330 * 60 * 1000);
}

function addIstDaysUtc(base: Date, days: number): Date {
  const istKey = toIstDateKey(base);
  const [y, m, d] = istKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days, 0, 0, 0));
  return istStartOfDayUtc(shifted);
}

function getIstDayOfWeek(base: Date): number {
  const istKey = toIstDateKey(base);
  const [y, m, d] = istKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).getUTCDay();
}

export function calculateNextDueDate(rule: IRecurringRule, fromDate: Date = new Date()): Date {
  const next = istStartOfDayUtc(fromDate);

  switch (rule.frequency) {
    case 'daily':
      return addIstDaysUtc(next, 1);

    case 'weekly':
      {
        const targetDay = rule.dayOfWeek ?? 0;
        const currentDay = getIstDayOfWeek(next);
        const daysUntilTarget = (targetDay - currentDay + 7) % 7;
        const delta = daysUntilTarget === 0 ? 7 : daysUntilTarget;
        return addIstDaysUtc(next, delta);
      }

    case 'monthly':
      {
        const targetDate = rule.dayOfMonth ?? 1;
        const nextMonthBase = istStartOfDayUtc(fromDate);
        const istKey = toIstDateKey(nextMonthBase);
        const [y, m] = istKey.split('-').map(Number);

        const candidateThis = new Date(Date.UTC(y, m - 1, targetDate, 0, 0, 0) - 330 * 60 * 1000);
        let candidate = candidateThis;
        if (candidate <= nextMonthBase) {
          candidate = new Date(Date.UTC(y, m, targetDate, 0, 0, 0) - 330 * 60 * 1000);
        }

        const candIstKey = toIstDateKey(candidate);
        const [cy, cm] = candIstKey.split('-').map(Number);
        if (candidate.getUTCDate() !== targetDate) {
          const lastDay = new Date(Date.UTC(cy, cm, 0, 0, 0, 0) - 330 * 60 * 1000);
          return lastDay;
        }
        return candidate;
      }

    case 'yearly':
      {
        const targetMonthDay = rule.dayOfMonth ?? 1;
        const base = istStartOfDayUtc(fromDate);
        const istKey = toIstDateKey(base);
        const [y] = istKey.split('-').map(Number);
        let candidate = new Date(Date.UTC(y, 0, targetMonthDay, 0, 0, 0) - 330 * 60 * 1000);
        if (candidate <= base) {
          candidate = new Date(Date.UTC(y + 1, 0, targetMonthDay, 0, 0, 0) - 330 * 60 * 1000);
        }
        return candidate;
      }
  }

  return next;
}

export async function materializeRecurringTransactions(
  dryRun: boolean = false,
  userId?: string,
): Promise<{
  created: number;
  skipped: number;
  transactions: Array<{
    ruleId: string;
    ruleName: string;
    particulars: string;
    amount: number;
    category: string;
    date: Date;
  }>;
}> {
  const RecurringRule = (await import('../models/RecurringRule')).default;

  const now = new Date();
  const today = istStartOfDayUtc(now);

  const filter: Record<string, unknown> = {
    isActive: true,
    nextDue: { $lte: today },
    $or: [
      { endDate: { $exists: false } },
      { endDate: { $gte: today } },
    ],
  };

  if (userId) {
    filter.userId = userId;
  }

  const rules = await RecurringRule.find(filter);

  const result = {
    created: 0,
    skipped: 0,
    transactions: [] as Array<{
      ruleId: string;
      ruleName: string;
      particulars: string;
      amount: number;
      category: string;
      date: Date;
    }>,
  };

  for (const rule of rules) {
    const transactionData: Record<string, unknown> = {
      date: rule.nextDue,
      particulars: rule.particulars,
      amount: rule.amount,
      category: rule.category,
      mode: rule.mode,
      notes: rule.notes || `Generated from recurring rule: ${rule.name}`,
    };

    if (userId) {
      transactionData.userId = userId;
    }

    result.transactions.push({
      ruleId: rule._id.toString(),
      ruleName: rule.name,
      particulars: rule.particulars,
      amount: rule.amount,
      category: rule.category,
      date: rule.nextDue,
    });

    if (!dryRun) {
      await Transaction.create({
        ...transactionData,
        dateKey: toIstDateKey(rule.nextDue),
      });

      const nextDue = calculateNextDueDate(rule, rule.nextDue);

      rule.lastGenerated = rule.nextDue;
      rule.nextDue = nextDue;

      // Check if rule should be deactivated
      if (rule.endDate && nextDue > rule.endDate) {
        rule.isActive = false;
      }

      await rule.save();
    }

    result.created++;
  }

  return result;
}
