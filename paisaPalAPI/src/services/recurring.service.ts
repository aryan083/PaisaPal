import type { IRecurringRule } from '../models/RecurringRule';
import Transaction from '../models/Transaction';

export function calculateNextDueDate(rule: IRecurringRule, fromDate: Date = new Date()): Date {
  const next = new Date(fromDate);

  switch (rule.frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;

    case 'weekly':
      const targetDay = rule.dayOfWeek ?? 0;
      const currentDay = next.getDay();
      const daysUntilTarget = (targetDay - currentDay + 7) % 7;
      next.setDate(next.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
      break;

    case 'monthly':
      const targetDate = rule.dayOfMonth ?? 1;
      // Create fresh date for next month calculation
      const nextMonth = new Date(fromDate);
      nextMonth.setDate(targetDate);
      if (nextMonth <= fromDate) {
        nextMonth.setMonth(nextMonth.getMonth() + 1);
      }
      // Handle months with fewer days (e.g., Feb 30 -> Feb 28/29)
      if (nextMonth.getDate() !== targetDate) {
        nextMonth.setDate(0); // Last day of previous month
      }
      return nextMonth;

    case 'yearly':
      const targetMonthDay = rule.dayOfMonth ?? 1;
      const nextYear = new Date(fromDate);
      nextYear.setDate(targetMonthDay);
      nextYear.setMonth(0); // January
      if (nextYear <= fromDate) {
        nextYear.setFullYear(nextYear.getFullYear() + 1);
      }
      return nextYear;
  }

  return next;
}

export async function materializeRecurringTransactions(dryRun: boolean = false): Promise<{
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
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const rules = await RecurringRule.find({
    isActive: true,
    nextDue: { $lte: today },
    $or: [
      { endDate: { $exists: false } },
      { endDate: { $gte: today } },
    ],
  });

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
    const transactionData = {
      date: rule.nextDue,
      particulars: rule.particulars,
      amount: rule.amount,
      category: rule.category,
      mode: rule.mode,
      notes: rule.notes || `Generated from recurring rule: ${rule.name}`,
    };

    result.transactions.push({
      ruleId: rule._id.toString(),
      ruleName: rule.name,
      particulars: rule.particulars,
      amount: rule.amount,
      category: rule.category,
      date: rule.nextDue,
    });

    if (!dryRun) {
      await Transaction.create(transactionData);

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
